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

## Redux Saga とは

- Redux の簡単な説明
- 弱点、副作用の実行方法
- Redux Saga の説明・利点
- thunkとの比較
- フローチャート図

## Swift で実装方針

Redux には ReSwift を利用します。

- Redux 本体への接点は極力すくなく
- saga（ビジネスロジック）は別の良いアーキテクチャがあった場合に、切り替えやすいようにする

## 実装例

- 実際のコード

## まとめ


Redux Saga の元々の開発言語である JavaScript と Swift の設計・性質が異なるので、完全再現は難しいです。
