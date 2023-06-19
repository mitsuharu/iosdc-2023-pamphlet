Redux の副作用を直感的に管理する Redux Saga を Swift でも使いたい
==

<div style="text-align: right;">
江本光晴（Twitter: @mitsuharu_e）
</div>
<div style="text-align: right;">
株式会社ゆめみ
</div>

あなたのお気に入りのアーキテクチャは何ですか。私のお気に入りは Redux Saga です。
Redux Saga [^redux-saga] は単方向データフローの Redux [^redux] を拡張し、
非同期処理や副作用を直感的に管理できるようにしたアーキテクチャです。
ビジネスロジックなどを Saga にまとめることで、責務を明確に分けることができます。

Redux Saga は JavaScript で作成され Web（React）や React Native などの開発でよく用いられます。
同じ宣言的 UI の SwiftUI との相性が期待できます。
しかし、残念なことに Swift で Redux Saga を実装したライブラリはありません。

それならば、自身で作成するしかありません。
JavaScript と Swift の言語設計と性質の違いを考慮しつつ、Swift の言語特性を活かす形で、
Redux Saga の主要な機能をどのように実装するかを解説します。
Redux Saga の特性や利点を紹介して、iOS アプリ開発における Redux Saga の可能性を探求します。

<!-- textlint-disable -->
[^redux]: https://github.com/reduxjs/redux
[^redux-saga]: https://github.com/redux-saga/redux-saga
<!-- textlint-enable -->

本記事では、Swift だけでなく JavaScript（TypeScript）のコードも提示します。
また、Redux Saga の API も挙げますが、詳細説明は省略します。
雰囲気を感じてもらう程度で問題ありません。

## Redux Saga とは

Redux は、JavaScript アプリの状態管理のための予測可能な状態コンテナです。
これにより、アプリ全体の状態を一元的に管理ができて、データフローを単純化して管理を容易にします。
しかし、Redux は非同期処理や副作用（データフェッチングやブラウザキャッシュへのアクセスなど）の管理が設計されていないため、
それらの処理の実装方法は明確に定められていません。
これは Redux の主な弱点の１つとされています。

そこで Redux Saga です。
Redux Saga は、非同期処理や副作用を効率的に管理するライブラリです。
Saga はアプリの中で副作用を個別に実行する独立したスレッドのような動作イメージです。
Redux Saga はミドルウェアとして実装されているため、Saga は Action に応じて起動、一時停止、中断ができます。
State 全体にアクセスでき、Action をディスパッチできます。

同様なライブラリの Redux Thunk と比較すると、
コールバック地獄に陥ることなく、非同期フローを簡単にテスト可能にし、Action を純粋に保つことができます。

![Redux Saga のデータフロー](./image/redux-saga.png "Redux Saga のデータフロー")

<!-- <div style="text-align: center;">
<img src="./image/redux-saga.png" alt="Redux Saga のデータフロー" title="Redux Saga のデータフロー" width="400">
</div> -->

たとえば、あるボタンをタップして、ユーザー情報を取得する例を考えましょう。
この場合、ボタンのタップイベントでユーザー情報を取得したいという Action を発行します。

```typescript
// View などでユーザー情報を取得する Action を発行（dispatch）する
const onPress = () => {
   dispatch(requestUser({userId: '1234'}))
}
```

事前に Redux Saga 側で takeEvery() で Action と Saga を紐付けをしておきます。
その Action が発行されたので、紐付けられた Saga が実行されます。

```typescript
// Redux Saga の初期設定時に Action に対応する処理を設定しておく
function* rootSaga() {
  // Action "requestUser" が発行されたら、fetchUserSaga を実行する
  yield takeEvery(requestUser, fetchUserSaga)
}

// ユーザー情報の取得を行う副作用
function* fetchUserSaga(action) {
  try {
    // たとえば、API からユーザー情報を取得する
  } catch (e) {
    // エラー処理（略）
  }
}
```

副作用は Saga にまとめて、View は必要な Action を発行するだけです。
Redux Saga にしたがっていれば、自ずと責務分けが実現されます。
私が Redux Saga の好きな特徴の１つです。

## Swift での実装アプローチ

Redux Saga の機能は多いため、まずは完全再現は目指さず、一部の機能から実装します。
そのため、今動作していても、他の機能を実装するときに不具合で修正する場合もあります。
また本記事では、紙面の都合上、middleware と takeEvery の実装を提示します。
middleware は既存の Redux から Redux Saga へ Action を伝える根底部分であり、
takeEvery はよく利用される機能の１つです。

Redux 本体の実装に既存のライブラリである ReSwift [^ReSwift] を利用します。
本来の JavaScript の実装ではジェネレーター関数が利用されていますが、
Swift では Swift Concurrency を利用します。
また Combine を用いて Action の発行監視を制御します。

なお、方針として Redux 本体への接点は極力少なく、独立したライブラリになるように心がけます。
これは Saga としてビジネスロジックを切り離して管理できるので、
たとえば将来的に他に優れたアーキテクチャが登場した場合などにおいて、
アーキテクチャの入替を容易にするためです。

今回は Xcode 14.3.1 を利用して、開発しています。

<!-- textlint-disable -->
[^ReSwift]: https://github.com/ReSwift/ReSwift バージョン 6.1.1 を利用しました
<!-- textlint-enable -->

## Swift で実装する

まずは Redux Saga の実装において Action の同一判定が必要になります。
ReSwift が定義する Action は空の Protocol なので、これを拡張します。
一般に enum や struct で利用されることが多いですが、
それらでは煩雑になってしまう、継承を利用したいため class にしました。

```swift
// Saga で利用する Action
class SagaAction: Action {}
```

先ほど挙げた例と同様に、ユーザー情報を取得する場合を考えます。

```swift
// Action をグループ管理したいので UserAction という中間のクラスを作る
class UserAction: SagaAction {}

// ユーザー情報を取得する Action
class RequestUser: UserAction {
    let userID: String
    init(userID: String) {
        self.userID = userID
    }
}
```

### 中核となる制御クラスを実装する

Action の管理や副作用の実行を制御するためのクラスを作成します。
クラス名は SagaMonitor にしました（実際に元の実装で利用されている名前です）。
このクラスが自作するライブラリの中核になります。
まずは Action の発行および購読の処理を実装します。

```swift
final class SagaMonitor {    
    public static let shared = SagaMonitor()    
    private let subject = PassthroughSubject<SagaAction, Error>()
    private var cancellable: AnyCancellable? = nil

    init() {
        observe()
    }

    // action を発行する
    func send(_ action: SagaAction){
        subject.send(action)
    }
    
    // middlewareから発行されるactionを受け取る
    private func observe(){
        cancellable = subject.sink { _ in
            // エラー処理（略）
        } receiveValue: { [weak self] action in
            // 発行された action に対する処理を行う（後述）
        }
    }
}
```

### middleware を実装する

SagaMonitor を用いて Saga 向けの middleware を実装します。

```swift
// Saga 向けの middleware を作成する
func createSagaMiddleware<State>() -> Middleware<State> {
    return { dispatch, getState in
        return { next in
            return { action in
                if let action = action as? (any SagaAction) {
                    SagaMonitor.shared.send(action)
                }
                return next(action)
            }
        }
    }
}
```

この middleware を ReSwift の Store に適用すれば、
Redux のフローに介入し、発行された Action を SagaProvider に伝達できます。

```swift
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

### takeEvery を実装する

次に takeEvery を作成します。
これは特定の Action と Saga を紐づけて、その Action が発行されるたびに指定した Saga を実行します。
まずは、それらを紐付ける構造体 SagaStore を作成します。

```swift
// Sagaで実行する関数の型
typealias Saga<T> = (SagaAction) async -> T

// サポートする実行パターン
enum SagaPattern {
    case takeEvery
}

// Action と Saga を紐づける構造体
struct SagaStore<T>: Hashable {
    
    let identifier = UUID().uuidString
        
    public func hash(into hasher: inout Hasher) {
        return hasher.combine(identifier)
    }
    
    static func == (lhs: SagaStore<T>, rhs: SagaStore<T>) -> Bool {
        return lhs.identifier == rhs.identifier
    }
    
    let pattern: SagaPattern
    let type: SagaAction.Type
    let saga: Saga<T>
}
```

制御クラス SagaMonitor にこの紐付けの構造体 SagaStore を追加します。

```swift
final class SagaMonitor {
    // ...
    
    private var stores = Set<SagaStore<Any>>()

    func addStore(_ store:SagaStore<Any>){
        stores.insert(store)
    }
}
```

発行された Action を受け取り、実行する処理を追加します。
構造体 SagaMonitor の中に一致する Action があれば、それぞれのパターンで Saga を実行させます。
ここの Action の比較で重要なのは、Action 自体（インスタンス）ではなく、
Action の種類（型）を比較するというところです。

```swift
final class SagaMonitor {
    
    // ...
        
    // middlewareから発行されるactionを受け取る
    private func observe(){
        cancellable = subject.sink { _ in
            // エラー処理（略）
        } receiveValue: { [weak self] action in
            // 発行された action に対する処理を行う
            self?.stores.filter { $0.type == type(of: action) }.forEach({ effect in
                 self?.execute(effect, action: action)
            })
        }
    }
    
    // 副作用をそれぞれのパターンで実行する
    private func execute(_ store: SagaStore<Any>, action: SagaAction) {
        switch store.pattern {
        case .takeEvery:
            Task.detached{
                let _ = await store.saga(action)
            }           
        default:
            break
        }
    }
}
```

SagaMonitor 側の準備が完了したので、最後に実際に利用する takeEvery を実装します。
構造体 SagaStore を渡して、Action が発行されるのを待ちます。

```swift
func takeEvery( _ action: SagaAction.Type, saga: @escaping Saga<Any>) {
    let store = SagaStore(pattern: .takeEvery, type: action.self, saga: saga)
    SagaMonitor.shared.addStore(store)
}
```

### takeEvery を利用する

takeEvery の内部実装が完了したので、実際に使ってみましょう。
まずは、実行させたい副作用の Saga を実装して、takeEvery 関数で Action と紐付けます。

```swift
// ユーザー情報を取得する Saga
let requestUserSaga: Saga = { action async in
    // API などでユーザー情報を取得する
}

// 起動時に実行される任意な関数
func setup(){
    takeEvery(RequestUser.self, saga: requestUserSaga)
}
```

これで準備が整いました。
適当な View の関数で Action "RequestUser" を発行する処理を書きましょう。

```swift
final class UserViewModel {
    // 適当なボタンイベントなどで呼ぶ  
    public func requestUser() {
        appStore.dispatch(RequestUser(userID: "1234"))
    }
}
```

この関数が実行されると、Action "RequestUser" が発行されて、
紐付く Saga "requestUserSaga" が実行されます。
View は Action を発行するだけで、実行される処理の実装には関与しません。
仮に Saga 内で State を更新する処理があれば、
その更新された State にしたがって、対応する View が更新されます。

## まとめ

本記事は、JavaScript ベースのライブラリ Redux Saga を Swift で実装する方法について解説しました。
JavaScript と Swift は言語の設計と性質が異なるため、Redux Saga の完全な再現は難しいです。
実際にいろいろ試作してうまくいかないこともあり、ChatGPT にも相談しました。
完全再現は諦めて、その概念を取り入れ、Swift の特性を活かす形での実装を試みて、
やっと形になりました。

今回は middleware と takeEvery の実装を紹介しました。
紙面の都合上で取り上げなかったのですが、
他にも put, call, fork, take そして takeLeading や takeLatest なども実装しています。
それらの実装を含め、今回のコードは GitHub で公開しています。
そのコードを通じて、Redux Saga の Swift における実装方法が理解できます。

url を書く。

Redux をベースとした iOS 向けのライブラリ、
たとえば ReSwift や The Composable Architecture（TCA）などは、すでに多くのアプリで利用されています。
今回の紹介した Redux Saga も他の iOS アプリ開発者に興味を持ってもらえれば、幸いです。

このプロジェクトはいずれ OSS として公開予定です。
