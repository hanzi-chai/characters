# 资料检索与原件记录

检索及下载日期：2026-10-22（Asia/Shanghai）。可核验的原始 URL、字节数、SHA-256 逐文件列于根目录 `sources.lock.json`。

本说明和来源锁文件纳入 Git；下述原件通过 `bun run download` 下载到本地，不纳入 Git。

## Unicode 18.0 正式资料

- [版本说明](https://www.unicode.org/versions/Unicode18.0.0/)
- [正式 UCD 目录](https://www.unicode.org/Public/18.0.0/ucd/)
- [UAX #38，修订 41](https://www.unicode.org/reports/tr38/tr38-41.html)，原件保留为 `research/tr38-41.html`。

已保存 UnicodeData、PropList、Blocks、Scripts、EquivalentUnifiedIdeograph、ReadMe、Unihan.zip 及解压后的八个文件，连同 Unicode License v3。ReadMe 明确标识为 18.0.0 正式数据，不使用 beta 或 `latest` 别名。

UAX #38 定义普通话字段及 T 源码，T 源编号的字面用十六进制；TU 表示源位置已移动，不能作为 CNS 字码解析。兼容字仅使用 UnicodeData 的规范分解；EquivalentUnifiedIdeograph 的外观近似不用于主表猜音。

## CNS11643 全字库

- [政府资料开放平台数据集 5961](https://data.gov.tw/dataset/5961)
- [官方全字库](https://www.cns11643.gov.tw/)
- [版本记录](https://data.cns11643.gov.tw/opendata/release.txt)
- [属性原始包](https://data.cns11643.gov.tw/opendata/Properties.zip)
- [码位对照原始包](https://data.cns11643.gov.tw/opendata/MapingTables.zip)
- [官方授权说明](https://www.cns11643.gov.tw/pageView.jsp?ID=59)

实际保存版本为 **20260805**，由官方包解压所需字段；完整压缩包保留。使用 `CNS_phonetic.txt`、`CNS_pinyin_1.txt`、`CNS_pinyin_2.txt` 与 Unicode BMP/2/3 对照。Unicode 15 平面的对照属于 PUA，不直接作为主表字符。

官方属性说明指定 `CNS_pinyin_1` 第 2 列为「漢語」，其余列是注音二式、耶鲁、威式、通用，不能混用。

下载官方包前用于核对格式的 [公开镜像](https://github.com/yintzuyuan/CNS11643-OpenData/tree/27a0ea7451215a4b4e5bad0fa1640977630e4b00) 六份原件也保存在 `sources/cns11643-mirror/`，提交为 `27a0ea7451215a4b4e5bad0fa1640977630e4b00`。构建使用官方包中的资料，不以镜像替代正式下载。

## pinyin-data

- [项目及来源说明](https://github.com/mozillazg/pinyin-data)
- [本次固定提交](https://github.com/mozillazg/pinyin-data/tree/9e5e9bdfe8add694300e0cc93a27b803b68377f9)

提交为 `9e5e9bdfe8add694300e0cc93a27b803b68377f9`（2026-10-18），上游数据版本 0.15.0，所据 Unihan 为 17.0.0；因此另外接入 Unicode 18.0 原件。保存整个上游压缩包及原文件，保留 `zdic.txt` 的无音注释，不能把整个文件的总行数当作有音字数。

除综合表外，保留各个 Unihan 转录、8105 字常用音、overwrite、kanji、nonCJKUI、汉典和 CC-CEDICT 单字转录。CC-CEDICT 资料的原始项目和许可见 [MDBG](https://www.mdbg.net/chinese/dictionary?page=cedict)。

## 万象带调单字表

- [项目](https://github.com/amzxyz/rime-wanxiang)
- [固定版本单字表](https://github.com/amzxyz/rime-wanxiang/blob/429bca38cec288ca9f6c322333908ce17adb0885/dicts/zi.dict.yaml)

提交为 `429bca38cec288ca9f6c322333908ce17adb0885`。保存 `zi.dict.yaml`、README、LICENSE。只接收一个 Unicode 码点的单字行，保留读音，忽略输入法权重和辅助码。

## 其他检索判断

也检索了宣称大字符集覆盖的拼音转换库，例如 [EzPinyin](https://github.com/AbotMe/ezpinyin)。字符范围大不能证明保留了可靠声调，本表没有借助无声调库补数字声调。未对汉典逐字网页进行全站抓取；采用上游已发布的文本快照。

尚无直接读音或明确规范分解依据的字符统一保留为 `xxx`。现有快照的读音覆盖率不是所有互联网资料可达到的理论上限；以后可以接入新资料并重新生成缺失清单。
