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

Redux Saga は JavaScript で作成され Web（React）や React Native などの開発でよく用いられています。
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
しかし、Redux は非同期処理や副作用（データフェッチングやデータベースへのアクセスなど）の管理が設計されていないため、
それらの処理の実装方法は明確に定められていません。
これは Redux の主な弱点の１つとされています。

そこで Redux Saga の登場です。
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
この場合、タップイベントでユーザー情報を取得したいという Action を発行します。

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
  // たとえば、API からユーザー情報を取得する
}
```

副作用は Saga にまとめて、View は必要な Action を発行するだけです。
Redux Saga にしたがっていれば、自ずと責務分けが実現されます。
私が Redux Saga の好きな特徴の１つです。

## Swift での実装アプローチ

Redux Saga の機能は多いため、まずは完全再現は目指さず、一部の機能から実装します。
そのため、今動作していても、他の機能を実装するときに不具合で修正する場合もあります。
また本記事では、紙面の都合上、middleware, call, take そして takeEvery の実装を提示します。
middleware は Redux から Redux Saga へ Action を伝える根底部分であり、
call, take, takeEvery はよく利用される機能の１つです。

本来の JavaScript の実装ではジェネレーター関数が利用されていますが、
Swift では Swift Concurrency を利用します。
また Action の非同期な発行監視は Combine で制御します。
なお、Redux 本体の実装に既存ライブラリの ReSwift [^ReSwift] を利用します。

ここで、方針として Redux 本体への接点は極力少なく、独立したライブラリになるように心がけます。
これは Saga としてビジネスロジックを切り離して管理できるので、
たとえば将来的に他に優れたアーキテクチャが登場した場合などにおいて、
アーキテクチャの入替を容易にするためです。

今回は Xcode 14.3.1 で開発しています。

<!-- textlint-disable -->
[^ReSwift]: https://github.com/ReSwift/ReSwift バージョン 6.1.1 を利用しました
<!-- textlint-enable -->

## Swift で実装する

まずは Redux Saga の実装において Action の比較が必要です。
ここでの比較はインスタンス同士の比較ではなく、Action の種類、つまり型レベルでの比較です。
ReSwift が定義する Action は空の Protocol で、
一般に enum や struct で利用されることが多いです。
enum では型レベルの比較が難しい、実装の過程で継承を利用したいので struct は難しいです。
そのため、class で Action を実装します。

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

### Action の発行監視を制御する

Action の発行や受信を制御するためのクラスを作成します。
クラス名は Channel にしました（実際に元の実装で利用されている名前です）。
このクラスが自作するライブラリの中核になります。
まずは Action の発行および購読の処理を実装します。

```swift
final class Channel {    
    public static let shared = Channel()
    private let subject = PassthroughSubject<SagaAction, Error>()

    // action を発行する
    func put(_ action: SagaAction){
        subject.send(action)
    }
    
    // 特定の action を受け取る
    func take(_ actionType: SagaAction.Type, 
            receive: @escaping (_ action: SagaAction) -> Void){
        // この監視は一度限りで行い、検出後は破棄する
        var cancellable: AnyCancellable? = nil
        cancellable = subject.filter {
            type(of: $0) == actionType
        }.sink { [weak self] in
            // エラー処理
            cancellable?.cancel()
        } receiveValue: {
            receive($0)
            cancellable?.cancel()
        }
    }
}
```

### middleware を実装する

Channel を用いて Saga 向けの middleware を実装します。

```swift
// Saga 向けの middleware を作成する
func createSagaMiddleware<State>() -> Middleware<State> {
    return { dispatch, getState in
        return { next in
            return { action in
                if let action = action as? (any SagaAction) {
                    Channel.shared.send(action)
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

### call を実行する

Saga は今後多様するので、型を定義しておきます。

```swift
// Sagaで実行する関数の型
typealias Saga<T> = (SagaAction) async -> T
```

call は単純に Saga とその引数を与えて実行する関数です。

```swift
@discardableResult
func call(_ effect: @escaping Saga<Any>,
         _ arg: SagaAction) async -> Any {
    return await effect(arg)
}
```

### take を実装する

take は特定の Action が発行されるのを待ちます。
Channel の take() を　withCheckedContinuation　で async/await に変換しました。

```swift
@discardableResult
func take(_ actionType: SagaAction.Type) async -> SagaAction {
    return await withCheckedContinuation { continuation in
        Channel.shared.take(actionType) { action in
            continuation.resume(returning: action)
        }
    }
}
```

### takeEvery を実装する

次に takeEvery を作成します。
これは特定の Action と Saga を紐づけて、その Action が発行されるたびに指定した Saga を実行します。

```swift
func takeEvery( _ actionType: SagaAction.Type,
              saga: @escaping Saga<Any>) {
    Task.detached {
        while true {
            let action = await take(actionType)
            await call(saga, action)
        }
    }
}
```

何このコード！？という感覚は正常です。
無限ループ中に take() で Action が発行されるまで待ち、
発行されたら Saga を実行する処理を繰り返します。

## Redux Saga を使おう

一連の実装が完了したので、実際に使ってみましょう。
まずは、実行させたい処理の Saga を実装します。
オリジナルの実装では Saga 関数がジェネレーター関数で他の関数と異なることもあって慣習的に xxxSaga と命名することが多いです。
今回 Swift での Saga 関数は通常の関数なので区別は必要ないですが、慣習にそった命名をしました。

```swift
// ユーザー情報を取得する Saga
let requestUserSaga: Saga = { action async in
    guard let action = action as? RequestUser else {
        // 引数の型をキャストして、想定してない型の場合は終了する
        return
    }
    // API などでユーザー情報を取得する
}
```

次に takeEvery 関数で Action と Saga を紐付けます。

```swift
// Saga を設定する関数
func setupSaga(){
    takeEvery(RequestUser.self, saga: requestUserSaga)
}
```

この設定関数は前に挙げた makeAppStore() で middleware を設定した後に、呼ぶとよいです。

```swift
func makeAppStore() -> Store<AppState> {
    // ...

    // store, middleware の設定後に呼ぶ
    setupSaga()

    return store
}
```

これで準備が整いました。
適当な View の関数で Action `RequestUser` を発行する処理を書きましょう。
今回は MVVM を想定して、適当な ViewModel を用意しました。

```swift
final class UserViewModel {
    // 適当なボタンイベントなどで呼ぶ  
    public func requestUser() {
        store.dispatch(RequestUser(userID: "1234"))
    }
}
```

この関数が実行されると、Action `RequestUser` が発行されて、
対応する Saga `requestUserSaga` が実行されます。
View は Action を発行するだけで、
処理の実装（記述）もすることはなく、実行される処理の責務には関与しません。
紙面の都合上、コードは省略しますが、上記の Saga にさらに State を更新する処理を追加すれば、
その更新された State にしたがって、対応する View が更新されます。

## 自作した Redux Saga の評価

あああ。

## まとめ

本記事は、JavaScript ベースのライブラリ Redux Saga を Swift で実装する方法について解説しました。
JavaScript と Swift は言語の設計と性質が異なるため、Redux Saga の完全な再現は難しいです。
実際にいろいろ試作してうまくいかないこともあり、ChatGPT にも相談しました。
完全再現は諦めて、その概念を取り入れ、Swift の特性を活かす形での実装を試みて、
やっと形になりました。

今回は middleware と call, take, takeEvery の実装を紹介しました。
紙面の都合上で取り上げなかったのですが、
他にも put, fork, selector そして takeLeading や takeLatest なども実装しています。
それらの実装を含め、今回のコードは GitHub で公開しています。
そのコードを通じて、Redux Saga の Swift における実装方法を見ることができます。

<!-- textlint-disable -->
https://github.com/mitsuharu/ReSwiftSagaSample
<!-- textlint-enable -->

Redux をベースとした iOS 向けのライブラリ、
たとえば ReSwift や The Composable Architecture（TCA）などは、すでに多くのアプリで利用されています。
今回の紹介した Redux Saga も他の iOS アプリ開発者に興味を持ってもらえれば、幸いです。

このプロジェクトはいずれ OSS として公開予定です。
