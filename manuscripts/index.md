Redux Saga を Swift でも使いたい
==

<div style="text-align: right;">
江本光晴（Twitter: @mitsuharu_e）
</div>
<div style="text-align: right;">
株式会社ゆめみ
</div>

皆様が好きなアーキテクチャは何でしょうか。
私が好きなアーキテクチャは Redux Saga です（正確には Redux を redux-saga ライブラリで拡張したものです）。
単方向データフローの Redux に加えて、ビジネスロジックなどを Saga にまとめることで、
アプリの副作用（何かしら変化が起こるピュアではない処理）を簡単に責務分け・制御できます。
Web（React）や React Native などの開発でよく使われてきたアーキテクチャで、
同じ宣言的 UI の SwiftUI と相性がよいはずです。
しかし、残念なことに Swift で Redux Saga を実現したライブラリはありません。
ないならば、作りましょう。本記事は、Redux Saga を Swift で実装する方法を紹介します。


<!-- 
https://github.com/redux-saga/redux-saga/blob/main/README_ja.md
redux-saga は React/Redux アプリケーションにおける副作用（データ通信などの非同期処理、ブラウザキャッシュへのアクセスのようなピュアではない処理）をより簡単で優れたものにするためのライブラリです。

Saga はアプリケーションの中で副作用を個別に実行する独立したスレッドのような動作イメージです。 redux-saga は Redux ミドルウェアとして実装されているため、スレッドはメインアプリケーションからのアクションに応じて起動、一時停止、中断が可能で、Redux アプリケーションのステート全体にアクセスでき、Redux アクションをディスパッチすることもできます。

ES6 の Generator 関数を使うことで読み書きしやすく、テストも容易な非同期フローを実現しています（もし馴染みがないようであればリンク集を参考にしてみてください）。それにより非同期フローが普通の同期的な JavaScript のコードのように見えます（async/await と似ていますが Generator 関数にしかないすごい機能があるんです）。

これまで redux-thunk を使ってデータ通信を行っているかもしれませんが、 redux-thunk とは異なりコールバック地獄に陥ることなく、非同期フローを簡単にテスト可能にし、アクションをピュアに保ちます。
-->

## Redux Saga とは

あああ。

## Swift で実装方針

Redux には ReSwift を利用します。

## 実装例

あああ。

## まとめ

あああ。

Redux Saga の元々の開発言語である JavaScript と Swift の性格性が異なるので、完全再現は難しいです。
