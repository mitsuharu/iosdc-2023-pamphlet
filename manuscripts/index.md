Redux Saga を Swift でも使いたい
==

<div style="text-align: right;">
江本光晴（Twitter: @mitsuharu_e）
</div>
<div style="text-align: right;">
株式会社ゆめみ
</div>

あなたのお気に入りのアーキテクチャは何ですか。私のお気に入りは Redux Saga です。
これは Redux を redux-saga ライブラリで拡張したものです。
単方向データフローの Redux に、ビジネスロジックなどをまとめた Saga を加えることで、
アプリの副作用を効率的に管理し、責務を明確に分けることができます。

Redux Saga は Web（React）や React Native などの開発でよく用いられるので、
同じ宣言的 UI の SwiftUI との相性が期待できます。
しかし、残念なことに Swift で Redux Saga を実装したライブラリはありません。
それならば、自身で作成するしかありません。
本記事は、Swift で Redux Saga をどのように実装するかを解説し、
実際に作成したライブラリを組み込んだ例を紹介します。

<!-- 
https://github.com/redux-saga/redux-saga/blob/main/README_ja.md
redux-saga は React/Redux アプリケーションにおける副作用（データ通信などの非同期処理、ブラウザキャッシュへのアクセスのようなピュアではない処理）をより簡単で優れたものにするためのライブラリです。

Saga はアプリケーションの中で副作用を個別に実行する独立したスレッドのような動作イメージです。 redux-saga は Redux ミドルウェアとして実装されているため、スレッドはメインアプリケーションからのアクションに応じて起動、一時停止、中断が可能で、Redux アプリケーションのステート全体にアクセスでき、Redux アクションをディスパッチすることもできます。

ES6 の Generator 関数を使うことで読み書きしやすく、テストも容易な非同期フローを実現しています（もし馴染みがないようであればリンク集を参考にしてみてください）。それにより非同期フローが普通の同期的な JavaScript のコードのように見えます（async/await と似ていますが Generator 関数にしかないすごい機能があるんです）。

これまで redux-thunk を使ってデータ通信を行っているかもしれませんが、 redux-thunk とは異なりコールバック地獄に陥ることなく、非同期フローを簡単にテスト可能にし、アクションをピュアに保ちます。
-->

本記事では説明のため、Swift だけでなく JavaScript（TypeScript）のコードも提示します。
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
Redux Saga に従っていれば、自ずと責務分けが実現されます。
私が Redux Saga が好きな点の１つです。

```typescript: Redux Saga の例
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

<!--
（Thunkに関してはカットしてもよいかも）
また、他にも非同期処理を取り扱うミドルウェア Redux Thunk があります。
しかし、これは複雑な非同期フロー（キャンセル可能な非同期操作や特定のアクションがディスパッチされるまで待つなど）を扱うのが難しいです。
それに対し、Redux Saga  はこれらの複雑なシナリオに対応するための強力なツールとなります。
-->

## Swift で実装方針

Redux 本体の実装には既存のライブラリである ReSwift [^ReSwift] を利用します。
Redux Saga の機能は多いため、一部の機能から実装を試みます。
具体的には、middleware, put, call, fork, take, takeEvery, takeLeading, takeLatest の各機能を再現します。
これらの機能は、Redux Saga の中心的な機能であり、これらを実装することで基本的なの動作を Swift で再現できます。

<!-- textlint-disable -->
[^ReSwift]: ReSwift 6.1.1 を利用します, https://github.com/ReSwift/ReSwift
<!-- textlint-enable -->

また、Redux 本体への接点は極力少なくなるようにします。
これは Saga としてビジネスロジックを切り離して管理できるので、
たとえば将来的に他の優れたアーキテクチャが登場した場合に、
アーキテクチャの切り替えを容易にするためです。

最後に、Swift での非同期処理には combine を利用します。
これらの方針の元で、Redux Saga の機能を Swift で実現します。

## 実装例

- 実際のコード

## まとめ

Redux Saga の元々の開発言語である JavaScript と Swift の設計・性質が異なるので、完全再現は難しいです。

Redux をベースとした、ReSwift や TCA などの iOS 向けのライブラリがあり、利用されています。
Redux Saga も iOS アプリ開発に多く利用されることを願っています。