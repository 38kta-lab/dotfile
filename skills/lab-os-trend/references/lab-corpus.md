# 増田研 コーパス（関連度採点の基準）

lab-os-trend は **user 個人の興味ではなく、この研究室（増田建 研究室, 東京大学 駒場）の
過去論文・研究テーマへの関連度**で新着論文を採点する。以下だけを判断材料に使う（portfolio は使わない）。

## 研究テーマ（関連度が高い領域）

- テトラピロール色素の生合成・代謝（heme / biliverdin / phycobilin / bilin）
- **ビリン還元酵素（FDBR superfamily; ferredoxin-dependent bilirubin reductase, PcyA, PebS, PubS, iBR 等）** の構造・進化・酵素機能
- フィコビリン色素（phycocyanobilin, phycoerythrobilin, phycourobilin）とフィコビリタンパク質
- 光受容体フィトクロム / cyanobacteriochrome、彩色順化（chromatic acclimation）
- シアノバクテリアの光合成、Acaryochloris（chlorophyll d/f）、遠赤色光順化
- ヘムオキシゲナーゼ、レトログレードシグナル（GUN1 等）、葉緑体・色素体分化
- SqrR / ポリスルフィド応答転写制御
- 腸内細菌のビリン代謝（stercobilin / urobilinogen / bilirubin reductase, ヒト便色素）と iBR
- 構造ベースの酵素探索・タンパク質構造進化（Foldseek/AFDB, 収斂進化）

## 検索キーワード（fetch_papers.py 用・カンマ区切り・単一ソース）

> **これが検索の唯一の定義**。SKILL.md では重複させず、この行を読んで `--keywords` に渡す。
> 設計＝daily-search-trend に倣い「**広い anchor 語（毎日の量を確保）＋焦点語（ニッチを射抜く）**」の二層。過広は関連度採点で沈める。
> 由来：過去15論文の PubMed MeSH＋著者キーワード集計（2026-09-10）＋ daily-trend の broad/focused 設計。
> **実測チューニング（2026-09-10）**: 単日 broad+focus で ~36件/日と十分。ただし `molecular evolution`（汎用すぎ・ラボ外進化論文を大量）と `polysulfide`（電池/材料化学を大量）は**検索から除外**し採点コーパス側でカバー。Arabidopsis / Gene Expression Regulation も広すぎるため不採用。

photosynthesis, cyanobacteria, photoreceptor, tetrapyrrole, phycobilin, phycocyanobilin, phycobiliprotein, phycoerythrobilin, bilin reductase, ferredoxin-dependent bilin reductase, biliverdin, heme oxygenase, heme-binding protein, phytochrome, cyanobacteriochrome, chromatic acclimation, chlorophyll f, far-red light photoacclimation, Acaryochloris, persulfide, SqrR, stercobilin, bilirubin reductase, GUN1

（先頭4つ = 広い anchor（ラボ隣接）／以降 = 焦点語。MeSH主要語：Phycobilins/Phycocyanin/Phytochrome/Tetrapyrroles/Heme/Heme Oxygenase-1/Chloroplasts/Photosynthesis/Sulfides。著者kw：chloroplast/retrograde signaling/polysulfide/redox signaling。論文が増えたら再集計。）

## 過去論文（近年・関連度の錨。タイトルの近さで採点の目安に）

1. Introduction of regioselective bacterial heme oxygenases into Arabidopsis hy1-1 supports the retrograde heme signaling hypothesis
2. Repeatability of protein structural evolution following convergent gene fusions
3. Evolutionary-conserved RLF, a cytochrome b5-like heme-binding protein, regulates organ development in Marchantia polymorpha
4. Tetrapyrrole photoreceptors in photosynthetic organisms
5. Phycocyanobilin binding and specific amino acid residues near the chromophore contribute to orange light perception by the dualchrome phytochrome region
6. Engineering of the phycourobilin synthase: PubS to a two-electron reductase
7. GENOMES UNCOUPLED PROTEIN1 is an RNA-binding protein essential for the maturation of chloroplast transcripts
8. Cytosolic heme metabolism by alternative localization of heme oxygenase 1 in plant cells
9. Thioredoxin regulates SqrR-mediated polysulfide-responsive transcription via reduction of sulfenylated thiol residues in SqrR
10. Polysulfide metabolizing enzymes influence SqrR-mediated sulfide-induced transcription by impacting intracellular polysulfide dynamics
11. Persulfide-responsive transcription factor SqrR regulates gene transfer and biofilm formation via the metabolic modulation of cyclic di-GMP in Rhodobacter capsulatus
12. Repressor activity of SqrR, a master regulator of persulfide-responsive genes, is regulated by heme coordination
13. Proteomic analysis of heme-binding protein from Arabidopsis thaliana and Cyanidioschyzon merolae
14. The retrograde signaling protein GUN1 regulates tetrapyrrole biosynthesis
15. Galactolipids are essential for internal membrane transformation during etioplast-to-chloroplast differentiation

（研究室の論文が増えたらここへ追記。fetch のキーワードもここで調整する。）
