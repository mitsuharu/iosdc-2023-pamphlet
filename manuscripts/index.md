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

## 実装のアプローチ

Redux Saga の機能は多いため、まずは完全再現は目指さず、一部の機能から実装を試みます。
また本記事では、紙面の都合上、middleware と takeEvery の実装を提示します。
middleware は既存の Redux から Saga へ Action を伝える根底部分であり、
takeEvery はよく利用される機能の１つです。

Redux 本体の実装には既存のライブラリである ReSwift [^ReSwift] を利用します。
元々の実装では Saga にジェネレーター関数が利用されていますが Swift Concurrency を利用します。
また Combine を用いて Action の発行監視を制御して、
Redux Saga の機能を Swift で実装します。
なお、方針として Redux 本体への接点は極力少なくなるようにします。
これは Saga としてビジネスロジックを切り離して管理できるので、
たとえば将来的に他に優れたアーキテクチャが登場した場合に、
アーキテクチャの切り替えを容易にするためです。

今回は Xcode 14.1 を利用して、開発しています。

<!-- textlint-disable -->
[^ReSwift]: https://github.com/ReSwift/ReSwift バージョン 6.1.1 を利用しました
<!-- textlint-enable -->

## Swift で実装する

Redux Saga の実装を始める前に Action の同一判定が必要になります。
ReSwift が定義する Action は空の Protocol で定義されるため、これを拡張します。

```swift
// Saga向けのAction（比較が必要なため Hashable を継承する）
protocol SagaAction: Action, Hashable {}

extension SagaAction {
    // プロトコルの時点では比較(==)が実装できないための回避策
    func isEqualTo(_ arg: any SagaAction) -> Bool {
        return self.hashValue == arg.hashValue
    }
}

// Action を enum で定義する（structでも問題なし）
enum CounterAction: SagaAction {
    case increase
    case decrease
}
```

Action の管理や副作用の実行を制御するためのクラス SagaProvider を作成します。
このクラスが自作するライブラリの中核になります。
まずは Action を発行する関数を作成します。

```swift
final class SagaProvider {    
    public static let shared = SagaProvider()    
    private let subject = PassthroughSubject<any SagaAction, Error>()

    // action を発行する
    func send(_ action: any SagaAction){
        subject.send(action)
    }
}
```

### middleware

SagaProvider を用いて Saga 向けの middleware を作成します。
作成した middleware を ReSwift の Store に適用すれば、
Redux のフローに介入し、アクションが発行されたときに SagaProvider にその情報を伝達します。

```swift
// Saga 向けの middleware を作成する
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

// ReSwift の初期設定を行う関数
func makeAppStore() -> Store<AppState> {
    // Saga 用の middleware を作成する
    let sagaMiddleware: Middleware<AppState> = createSagaMiddleware()
    
    let store = Store<AppState>(
        reducer: appReducer,
        state: AppState.initialState(),
        middleware: [sagaMiddleware]
    )
    return store
}
```

### takeEvery

次に takeEvery を作成します。
これは特定の Action と Saga を紐づけて、その Action が発行されるたびに指定した Saga を実行します。
まずは、それらを紐付ける構造体 SagaEffect を作成します。

```swift
// Sagaで実行する関数の型
typealias Saga<T> = (_ action: (any SagaAction)?) async -> T

// サポートする実行パターン
enum SagaPattern {
    case takeEvery
}

// Action と Saga を紐づける構造体
struct SagaEffect<T>: Hashable {
    
    let identifier = UUID().uuidString
        
    public func hash(into hasher: inout Hasher) {
        return hasher.combine(identifier)
    }
    
    static func == (l: SagaEffect<T>, r: SagaEffect<T>) -> Bool {
        return l.identifier == r.identifier
    }
    
    let pattern: SagaPattern
    let action: (any SagaAction)?
    let saga: Saga<T>?
}
```

制御クラス SagaProvider にこの紐付けの構造体 SagaEffect を追加します。

```swift
final class SagaProvider {
    // ...
    
    private var effects = Set<SagaEffect<Any>>()

    func addEffect(_ effect:SagaEffect<Any>){
        effects.insert(effect)
    }
}
```

発行される Action を受け取り、実行する処理を追加します。

```swift
final class SagaProvider {
    
    // ...
    
    private let subject = PassthroughSubject<any SagaAction, Error>()
    private var cancellable: AnyCancellable? = nil

    init() {
        observe()
    }
    
    // middlewareから発行されるactionを受け取る
    private func observe(){
        cancellable = subject.sink { _ in
            // エラー処理（略）
        } receiveValue: { [weak self] action in
            // 発行されたactionに対する副作用があれば、逐次実行する
            self?.effects.filter { $0.action?.isEqualTo(action) == true }.forEach({ effect in
                self?.execute(effect)
            })
        }
    }
    
    /**
     副作用をそれぞれのパターンで実行する
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
}
```

SagaProvider 側の準備が完了したので、最後に実際に利用する takeEvery を実装します。

```swift
public func takeEvery<T>( _ action:  any SagaAction, saga: @escaping Saga<T>)  {
    SagaProvider.shared.addEffect(SagaEffect(pattern: .takeEvery, action: action, saga: saga))
}
```

### Saga を実行する

最後に Saga を作成して、takeEvery を有効にします。

```swift
// 何かの処理を実行する Saga
let increaseSaga: Saga = { (_ action: Action?) async in
    print("call increaseSaga")
}

// 起動時に実行される任意な関数
func setup(){
    // Action "increase" が発行されたら "increaseSaga" を実行する
    takeLatest(CounterAction.increase, saga: increaseSaga)
}
```

これですべての準備が整いました。
適当な View の関数で Action "increase" を発行する処理を書きましょう。
この関数が実行されると、Action "increase" が発行されて、"increaseSaga" が実行されます。
View は Action を発行するだけで、実行される処理の実装には関与しません。

```swift
final class CounterViewModel {    
    public func increase() {
        appStore.dispatch(CounterAction.increase)
    }
}
```


## まとめ

この記事では、JavaScript ベースのライブラリ Redux Saga を Swift で実装する方法について解説しました。
JavaScript と Swift の設計と性質が異なるため、Redux Saga の完全な再現は難しいですが、
その概念を取り入れ、Swift の特性を活かす形での実装を試みました。

今回は middleware と takeEvery の実装を紹介しました。
紙面の都合上、取り上げなかったですが、他に call や take なども実装しています。
それらの実装を含め、今回のコードを GitHub で公開しています。
そのコードを通じて、Redux Saga の Swift における実装方法が理解できます。

Redux をベースとした iOS 向けのライブラリ、
たとえば ReSwift や The Composable Architecture（TCA）などは、すでに多くのアプリで利用されています。
今回の紹介した Redux Saga も、iOS アプリ開発における新たな候補となり、
他の開発者も利用されると嬉しいです。

このプロジェクトはいずれ OSS として公開予定です。
