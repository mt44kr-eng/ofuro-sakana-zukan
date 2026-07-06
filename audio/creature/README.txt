収録音声(子どもの声)の置き場所

■ ファイル名の規則(idは data/creatures.json 参照)
- {id}.m4a または {id}.mp3 (m4a優先で探すので、iPhoneボイスメモのままでOK)
- 例: doctor_fish.m4a / koi.m4a / giant_isopod.m4a

■ ゾーン完了・グランド完了音声(別フォルダ)
- audio/zone/river.mp3, ocean.mp3, deepsea.mp3
- audio/grand/take.mp3, matsu.mp3
- いずれも「コンプリート！」のみ(ゾーン名の前置は可)

■ 台本
data/creatures.json の line がそのまま音声原稿です。

■ 進め方(仕様書 §7)
まず doctor_fish 1本だけ入れて、形式・音量・再生タイミングを実機確認
→ OKなら残りを一括収録・投入

■ 録音のコツ
- 静かな部屋で、口から15cmくらい離して録る
- 1ファイル=1セリフ
- ファイルが無い間は「※こえは じゅんびちゅう」と表示されます
