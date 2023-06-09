Redux Saga を Swift でも使いたい
==

<div style="text-align: right;">
江本光晴（Twitter: @mitsuharu_e）
</div>
<div style="text-align: right;">
株式会社ゆめみ
</div>

あなたのお気に入りのアーキテクチャは何ですか。私のお気に入りは Redux Saga です。
これは Redux [^redux] を redux-saga [^redux-saga] ライブラリで拡張したものです。
単方向データフローの Redux に、ビジネスロジックなどをまとめた Saga を加えることで、
アプリの副作用を効率的に管理し、責務を明確に分けることができます。

Redux Saga は Web（React）や React Native などの開発でよく用いられるので、
同じ宣言的 UI の SwiftUI との相性が期待できます。
しかし、残念なことに Swift で Redux Saga を実装したライブラリはありません。
それならば、自身で作成するしかありません。
本記事は、Swift で Redux Saga をどのように実装するかを解説し、
実際に作成したライブラリを組み込んだ例を紹介します。

<!-- textlint-disable -->
[^redux]: https://github.com/reduxjs/redux
[^redux-saga]: https://github.com/redux-saga/redux-saga
<!-- textlint-enable -->

<!-- 
https://github.com/redux-saga/redux-saga/blob/main/README_ja.md
redux-saga は React/Redux アプリケーションにおける副作用（データ通信などの非同期処理、ブラウザキャッシュへのアクセスのようなピュアではない処理）をより簡単で優れたものにするためのライブラリです。

Saga はアプリケーションの中で副作用を個別に実行する独立したスレッドのような動作イメージです。 redux-saga は Redux ミドルウェアとして実装されているため、スレッドはメインアプリケーションからのアクションに応じて起動、一時停止、中断が可能で、Redux アプリケーションのステート全体にアクセスでき、Redux アクションをディスパッチすることもできます。

ES6 の Generator 関数を使うことで読み書きしやすく、テストも容易な非同期フローを実現しています（もし馴染みがないようであればリンク集を参考にしてみてください）。それにより非同期フローが普通の同期的な JavaScript のコードのように見えます（async/await と似ていますが Generator 関数にしかないすごい機能があるんです）。

これまで redux-thunk を使ってデータ通信を行っているかもしれませんが、 redux-thunk とは異なりコールバック地獄に陥ることなく、非同期フローを簡単にテスト可能にし、アクションをピュアに保ちます。
-->

本記事では、Swift だけでなく JavaScript（TypeScript）のコードも提示します。
また、Redux Saga の API も挙げますが詳細説明は省略します。
雰囲気を感じてもらう程度で問題ないです。

## Redux Saga とは

Redux は、JavaScript アプリケーションの状態管理のための予測可能な状態コンテナです。
これにより、アプリケーション全体の状態を一元的に管理ができて、これによってデータフローを単純化し、管理を容易にします。
しかし、Redux は非同期処理や副作用の管理が設計されていないため、それらの処理の実装方法は明確に定められていません。
これは、Redux の主な弱点の１つとされています。

そこで Redux Saga が登場します。
Redux Saga は、副作用（データフェッチングやブラウザキャッシュへのアクセスなど）を効率的に管理するためのミドルウェアです。

![Redux Saga](./image/redux-saga.png "Redux Saga")

<!-- <div style="text-align: center;">
<img src="./image/redux-saga.png" alt="Redux Saga" title="Redux Saga" width="400">
</div> -->

たとえば、あるボタンをタップして、ユーザー情報を取得する例を考えましょう。
この場合、ボタンのタップイベントでユーザー情報を取得したいという Action を発行します。
すると、Redux Saga 側でその Action に紐付いている Saga が実行されます。
副作用は Saga にまとめておいて、
View は対応する Action を発行するだけで、対応する副作用が実行されます。
Redux Saga にしたがっていれば、自ずと責務分けが実現されます。
私が Redux Saga が好きな点の１つです。

```typescript
// View などでユーザー情報を取得する Action を発行（dispatch）する
const onPress = () => {
   dispatch(requestUser({userId: xxx}))
}

// Redux Saga の初期設定時に Action に対応する処理を設定しておく
function* rootSaga() {
  // Action "requestUser" が発行されたら、fetchUserSaga を実行する
  yield takeEvery(requestUser, fetchUserSaga)
}

// ユーザー情報の取得を行う副作用
function* fetchUserSaga(action) {
  try {
    const user = yield call(Api.fetchUser, action.payload.userId)
    yield put(storeUser(user))
  } catch (e) {
    // エラー処理（略）
  }
}
```

## Swift で実装方針

Redux Saga の機能は多いため、一部の機能から実装を試みます。
具体的には、middleware, put, call, fork, take, takeEvery の各機能を再現します。
これらの機能はよく利用される機能であり、これらを実装することで最低限の動作を Swift で再現できます。

<!-- 紙面は middleware, takeEvery ぐらい？ -->

Redux 本体の実装には既存のライブラリである ReSwift [^ReSwift] を利用します。
元々の実装では Saga にジェネレーター関数が利用されていますが Swift Concurrency を利用します。
また Combine を用いて Action の発行監視を制御します。
これらから、Redux Saga の機能を Swift で実装します
なお、Redux 本体への接点は極力少なくなるようにします。
これは Saga としてビジネスロジックを切り離して管理できるので、
たとえば将来的に他の優れたアーキテクチャが登場した場合に、
アーキテクチャの切り替えを容易にするためです。

<!-- textlint-disable -->
[^ReSwift]: ReSwift 6.1.1 を利用します, https://github.com/ReSwift/ReSwift
<!-- textlint-enable -->

## 実装例

簡単なカウンターアプリを例にして、実装をご紹介します。
まず Action が同一かどうかの比較が必要になるので拡張します。

```swift
// Saga向けのAction（比較が必要なため Hashable を継承する）
protocol SagaAction: Action, Hashable {}

extension SagaAction {
    // プロトコルでは直接比較(==)できないための回避策
    func isEqualTo(_ arg: any SagaAction) -> Bool {
        return self.hashValue == arg.hashValue
    }
}

enum CounterAction: SagaAction {
    case increase
    case decrease
}
```

その後、sagaの通知管理や副作用実行を制御するためのクラス、SagaProviderを作成します。SagaProviderはアクションの監視や、それに応じた副作用の発火を行います。

次に、actionを通知するためのmiddlewareを作ります。このmiddlewareはReduxのフローに介入し、特定のアクションが発行されたときにSagaProviderへとその情報を伝達します。

最後に、takeEveryを実現するコードを作成します。takeEveryは、特定のアクションが発行されるたびに特定のsagaが実行されるという動作を制御します。

以上が、簡単なカウンターアプリにおけるRedux SagaのSwiftでの実装例です。この構成により、副作用のあるアクションの管理と制御を効率的に行うことが可能となります。




```swift
let counterSaga: Saga = { (_ action: Action?) in
    takeLatest(CounterAction.increase, saga: increaseSaga)
}

let increaseSaga: Saga = { (_ action: Action?) async in
    print("increaseSaga", action ?? "", "start")
    
    Task{
        try? await Task.sleep(nanoseconds: 1_000_000_000)
    }
    print("increaseSaga", action ?? "", "end")
    
    
    let aaaa = await take(CounterAction.decrease as (any SagaAction))
    print("increaseSaga take:", aaaa )
}


func makeAppStore() -> Store<AppState> {
    
    let sagaMiddleware: Middleware<AppState> = createSagaMiddleware()
    
    let store = Store<AppState>(
        reducer: appReducer,
        state: AppState.initialState(),
        middleware: [sagaMiddleware]
    )

    // これは初回設定sagaみたいな処理にする。ここは仮に置いている
    Task {
        await call(counterSaga)
    }
    
    return store
}

final class CounterViewModel {    
    public func increase() {
        appStore.dispatch(CounterAction.increase)
    }
}
```



```swift
// Sagaで実行する関数の型
typealias Saga<T> = (_ action: (any SagaAction)?) async -> T

// 構造体 SagaEffect でサポートする副作用
enum SagaPattern {
    case take
    case takeEvery
    case takeLeading
    case takeLatest
}

// Saga の機能をまとめる構造体
struct SagaEffect<T>: Hashable {
    
    let identifier = UUID().uuidString
        
    public func hash(into hasher: inout Hasher) {
        return hasher.combine(identifier)
    }
    
    static func == (lhs: SagaEffect<T>, rhs: SagaEffect<T>) -> Bool {
        return lhs.identifier == rhs.identifier
    }
    
    let pattern: SagaPattern
    let action: (any SagaAction)?
    let saga: Saga<T>?
}
```

```swift
// Provider
final class SagaProvider {
    
    public static let shared = SagaProvider()
    
    private let subject = PassthroughSubject<any SagaAction, Error>()
    private var effects = Set<SagaEffect<Any>>()
    private var cancellable: AnyCancellable? = nil

    init() {
        observe()
    }
    
    /**
     action を発行する
     */
    func send(_ action: any SagaAction){
        subject.send(action)
    }
    
    /**
     takeEveryなどの副作用を記録する
     */
    func addEffect(_ effect:SagaEffect<Any>){
        effects.insert(effect)
    }
    
    /**
     middlewareから発行されるactionを受け取る
     */
    private func observe(){
        cancellable = subject.sink { [weak self] in
            self?.complete($0)
        } receiveValue: { [weak self] action in
            // 発行されたactionに対する副作用があれば、逐次実行する
            self?.effects.filter { $0.action?.isEqualTo(action) == true }.forEach({ effect in
                self?.execute(effect)
            })
        }
    }
    
    /**
     副作用をそれぞれのタイミングで実行する
     */
    private func execute(_ effect: SagaEffect<Any>) {
        switch effect.pattern {
        case .takeEvery:
            if let saga = effect.saga{
                Task.detached{
                    let _ = await saga(effect.action)
                }
            }            
        default:
            break
        }
    }
    
    /**
     特定の action を監視して、イベントを実行する。主に take 向け。
     */
    func match(_ action: any SagaAction, receive: @escaping (_ action: any SagaAction) -> Void ){
        // 監視は一度限りで行い、検出後は破棄する
        // 破棄しないと、検出した action を対応にした場合、withCheckedContinuation で二重呼び出しにカウントされクラッシュする
        var cancellable: AnyCancellable? = nil
        
        cancellable =  subject.filter {
            $0.isEqualTo(action)
        }.sink { [weak self] in
            self?.complete($0)
            cancellable?.cancel()
        } receiveValue: {
            receive($0)
            cancellable?.cancel()
        }
    }
    
    func cancel() {
        effects.removeAll()
        cancellable?.cancel()
        currentTasks.values.forEach { $0.cancel() }
    }
    
    /**
     エラー時の処理
     @TODO: エラーを投げるかは検討
     */
    private func complete(_ completion: Subscribers.Completion<Error>){
        switch completion {
        case .finished:
            print("SagaProvider#finished")
        case .failure(let error):
            assertionFailure("SagaProvider#failure \(error)")
        }
    }
}
```

```swift
func createSagaMiddleware<State>() -> Middleware<State> {
    return { dispatch, getState in
        return { next in
            return { action in
                if let action = action as? (any SagaAction) {
                    SagaProvider.shared.send(action)
                }
                return next(action)
            }
        }
    }
}
```

```swift
func put(_ action: any SagaAction){
    SagaProvider.shared.send(action)
}

func call<T>(_ effect: @escaping Saga<T>, _ arg: ( any SagaAction)? = nil) async -> T{
    return await effect(arg)
}

func fork<T>(_ effect: @escaping Saga<T>, _ arg: ( any SagaAction)? = nil){
    Task.detached {
        await effect(arg)
    }
}

func take(_ action: any SagaAction) async -> any SagaAction {
    return await withCheckedContinuation { continuation in
        SagaProvider.shared.match(action) { action in
            continuation.resume(returning: action)
        }
    }
}

func takeEvery<T>( _ action:  any SagaAction, saga: @escaping Saga<T>)  {
    SagaProvider.shared.addEffect(SagaEffect(pattern: .takeEvery, action: action, saga: saga))
}
```


## まとめ

Redux Saga の元々の開発言語である JavaScript と Swift の設計・性質が異なるので、完全再現は難しいです。

Redux をベースとした、ReSwift や TCA などの iOS 向けのライブラリがあり、利用されています。
Redux Saga も iOS アプリ開発に多く利用されることを願っています。

本記事で紹介したコードは GitHub https://github.com/mitsuharu/ReSwiftSagaSample で公開しています。
ゆくゆくはライブラリ化したいと思っています。
