# Unicode 18.0 汉字与中日韩符号拼音表

以 Unicode 18.0.0 正式数据为基础，逐字符整理带数字声调的拼音，无法取得读音时记作 `xxx`。原始资料、逐条来源证据和处理脚本均可在本地保留及复现。

仓库追踪 TypeScript / Bun 代码、配置、来源锁文件和说明；下载原件（`sources/`）、生成数据（`data/`）及压缩包（`dist/`）保存在本地，不纳入 Git。

## 使用

需要 Bun（已使用 1.4.2 验证），以及系统 `tar`、`unzip`；无第三方运行时依赖，无需 `bun install`。

```sh
# 首次克隆：下载原件、生成拼音表并核验
bun run download
bun run build
bun run check

# 查字；--evidence 显示原始文件、行号和映射依据
bun run lookup 张行绿 U+33472
bun run lookup U+33472 --evidence

# 原件已在本地时可离线重建并验证字节一致
bun run repro

# 打包含原件、生成数据、脚本和说明的本地压缩包
bun run package
```

下载默认检查 `sources.lock.json` 中的 SHA-256。上游可变 URL 更新时会拒绝不匹配的文件；确认要采用新版本后，执行 `bun run download --refresh`，再重新构建和核验。

## 字符范围

主表包含 `Unified_Ideograph` 属性的全部字符、`U+3007`「〇」，以及下列八个区块的**全部已分配字符**，去重后按码点升序排列：

| 区块 | Unicode 名称 | 区块范围 |
|---|---|---|
| 中日韩部首补充 | CJK Radicals Supplement | U+2E80–U+2EFF |
| 康熙部首 | Kangxi Radicals | U+2F00–U+2FDF |
| 中日韩笔画 | CJK Strokes | U+31C0–U+31EF |
| 中日韩兼容表意文字 | CJK Compatibility Ideographs | U+F900–U+FAFF |
| 中日韩兼容表意文字补充 | CJK Compatibility Ideographs Supplement | U+2F800–U+2FA1F |
| 中日韩符号和标点 | CJK Symbols and Punctuation | U+3000–U+303F |
| 中日韩带圈字母和月份 | Enclosed CJK Letters and Months | U+3200–U+32FF |
| 中日韩带圈文字补充 | Enclosed Ideographic Supplement | U+1F200–U+1F2FF |

原有汉字范围共 103,000 字（含 1,014 个兼容表意文字及「〇」），新增相关区块字符 750 个。两个兼容表意文字区块已在原有范围中，不重复计数。包括统一汉字扩展 A–J、Unicode 18.0 新增的 `U+2B81E`，不收录区块内未分配码点、私用区、变体选择符及独立的小篆、女真文字。

这些区块也包含标点、韩文字母、假名和其他符号；收录它们并不表示它们都存在普通话读音，无法取得读音时同样保留 `xxx`。标点取字符自身的读音，不把符号名称当作拼音。

## 拼音与输出格式

- 声调用 `1`–`4`，轻声用 `5`：`zhang1`、`le5`。
- `ü` 写作 `v`：`女 → nv3`、`绿 → lv4,lu4`；`ê` 保留为 `ê2` 等形式，输出不完全限于 ASCII。
- 同字多音用逗号分隔；少数一字多音节用连字符连接，如 `瓩 → qian1-wa3`。
- 保留来源收录的古音、异读和地区差异，默认读音是来源优先级产生的回退值，不负责词语中的多音字消歧。
- 仅按 Unicode 明确给出的**单个统一汉字分解**为缺音字符补音，包括兼容字、部首和带圈字等；例如 `⼀ → 一`、`㊤ → 上`。不由外观近似、声旁或简繁关系猜音，也不将多字分解机械拼成读音。

所有生成文件位于本地 `data/`：

| 文件 | 内容 |
|---|---|
| `pinyin.txt` | 最简两列：`字符<TAB>拼音`，无表头，多音用逗号分隔 |
| `pinyin-default.txt` | 每字符一个默认读音，缺失为 `xxx` |
| `pinyin.tsv` | 码点、字符、全部读音、默认读音、状态、区块、来源 |
| `pinyin.json` | `字符 → 拼音数组`，缺失为 `["xxx"]` |
| `evidence.jsonl` | 每字符逐条原始读音、来源文件、行号及 CNS / Unicode 连接依据 |
| `missing.tsv` | 所有 `xxx` 字符 |
| `coverage.json` | 区块及来源的机器可读统计；可读报告直接显示在本 README |
| `source-disagreements.tsv` | 来源间读音集合不同的字符 |
| `supplement-only.tsv` | 仅由汉典、CC-CEDICT 或万象补充的字符 |
| `rejected-readings.jsonl` | 无法采用的原始记录，包含已由另一官方表成功回退的异常 |
| `cns-mapping-conflicts.json` | CNS / Unihan 既有码点映射差异 |
| `manifest.json` | 生成数据文件的 SHA-256 |

`direct` 表示来源直接收录；`unicode-decomposition` 表示依据 Unicode 分解补音；`missing` 表示 `xxx`。

## 覆盖率

以下统计由 `bun run build` 随拼音表一起更新。

<!-- coverage:start -->

字符总数 **103,750**；有读音 **81,729**（78.7749%）；缺失 **22,021**，记作 `xxx`。来源快照日期：2026-10-22。

直接来源 80912 字符；Unicode 分解补音 817 字符；多读音 22698 字符；仅补充来源收录 54 字符。

| 区块 | 码点范围 | 已分配字符 | 有读音 | xxx | 读音覆盖率 |
|---|---|---:|---:|---:|---:|
| 中日韩部首补充 | U+2E80–U+2EFF | 115 | 2 | 113 | 1.7391% |
| 康熙部首 | U+2F00–U+2FDF | 214 | 214 | 0 | 100% |
| 中日韩符号和标点 | U+3000–U+303F | 64 | 4 | 60 | 6.25% |
| 中日韩笔画 | U+31C0–U+31EF | 39 | 0 | 39 | 0% |
| 中日韩带圈字母和月份 | U+3200–U+32FF | 255 | 53 | 202 | 20.7843% |
| 中日韩统一表意文字扩展 A | U+3400–U+4DBF | 6592 | 6587 | 5 | 99.9242% |
| 中日韩统一表意文字 | U+4E00–U+9FFF | 20992 | 20963 | 29 | 99.8619% |
| 中日韩兼容表意文字 | U+F900–U+FAFF | 472 | 463 | 9 | 98.0932% |
| 中日韩带圈文字补充 | U+1F200–U+1F2FF | 64 | 45 | 19 | 70.3125% |
| 中日韩统一表意文字扩展 B | U+20000–U+2A6DF | 42720 | 42691 | 29 | 99.9321% |
| 中日韩统一表意文字扩展 C | U+2A700–U+2B73F | 4160 | 4105 | 55 | 98.6779% |
| 中日韩统一表意文字扩展 D | U+2B740–U+2B81F | 223 | 197 | 26 | 88.3408% |
| 中日韩统一表意文字扩展 E | U+2B820–U+2CEAF | 5774 | 2131 | 3643 | 36.9068% |
| 中日韩统一表意文字扩展 F | U+2CEB0–U+2EBEF | 7473 | 134 | 7339 | 1.7931% |
| 中日韩统一表意文字扩展 I | U+2EBF0–U+2EE5F | 622 | 251 | 371 | 40.3537% |
| 中日韩兼容表意文字补充 | U+2F800–U+2FA1F | 542 | 542 | 0 | 100% |
| 中日韩统一表意文字扩展 G | U+30000–U+3134F | 4939 | 1478 | 3461 | 29.9251% |
| 中日韩统一表意文字扩展 H | U+31350–U+323AF | 4192 | 935 | 3257 | 22.3044% |
| 中日韩统一表意文字扩展 J | U+323B0–U+3347F | 4298 | 934 | 3364 | 21.731% |

同一字符可以被多个来源收录，以下数字不能相加。统计包含分解补音后的归属，可能高于原始文件行数。

| 来源 | 字符数 | 不同字音对 |
|---|---:|---:|
| CNS11643:phonetic | 79194 | 98120 |
| Unihan18:kHanyuPinlu | 4315 | 4966 |
| Unihan18:kHanyuPinyin | 34885 | 46163 |
| Unihan18:kMandarin | 45152 | 45265 |
| Unihan18:kSMSZD2003Readings | 8785 | 10083 |
| Unihan18:kTGHZ2013 | 8593 | 9352 |
| Unihan18:kXHC1983 | 11720 | 13290 |
| pinyin-data:cc_cedict | 6745 | 8187 |
| pinyin-data:kHanyuPinlu | 4315 | 4966 |
| pinyin-data:kHanyuPinyin | 34885 | 46163 |
| pinyin-data:kMandarin | 45152 | 45265 |
| pinyin-data:kMandarin_8105 | 8593 | 8593 |
| pinyin-data:kMandarin_overwrite | 66 | 66 |
| pinyin-data:kTGHZ2013 | 8593 | 9352 |
| pinyin-data:kXHC1983 | 11720 | 13290 |
| pinyin-data:kanji | 31 | 31 |
| pinyin-data:nonCJKUI | 1 | 3 |
| pinyin-data:overwrite | 41 | 75 |
| pinyin-data:pinyin | 45174 | 57318 |
| pinyin-data:zdic | 42854 | 50164 |
| wanxiang:zi | 44132 | 52122 |

未接受的原始读音记录 214 条，含已由另一官方表成功回退的异常数字拼音，不代表同字最终缺音。17367 个字符的来源读音集合不同，可能出于收录详略、古今或地区差异。CNS / Unihan 的 12 处既有码点映射差异保留在审计文件中。

<!-- coverage:end -->

## 数据来源与处理

原始 URL、字节数、SHA-256 逐文件记录于 [sources.lock.json](sources.lock.json)；下载入口及固定版本记录于 [src/sources.ts](src/sources.ts)。原件、压缩包和上游许可证均保存到本地 `sources/`。处理过程只运行 TypeScript / Bun；上游原件中自带的 Python 脚本仅作原件保留。

| 来源 | 固定版本与原件 | 用途 |
|---|---|---|
| [Unicode UCD / Unihan](https://www.unicode.org/Public/18.0.0/ucd/) | Unicode 18.0.0 正式版；`sources/unicode-18.0.0/` | 字符范围、普通话字段、T 源对应、Unicode 分解 |
| [数位发展部 CNS11643 全字库](https://data.gov.tw/dataset/5961) | 20260805；`sources/cns11643/Properties.zip`、`MapingTables.zip`、`release.txt` | CNS → Unicode、CNS → 注音、注音 → 汉语拼音 |
| [mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data/tree/9e5e9bdfe8add694300e0cc93a27b803b68377f9) | 提交 `9e5e9bdfe8add694300e0cc93a27b803b68377f9`，0.15.0；完整上游包与原文件 | 综合字音、8105 字常用音、人工纠错、汉典及 CC-CEDICT 单字转录 |
| [万象带调单字表](https://github.com/amzxyz/rime-wanxiang/blob/429bca38cec288ca9f6c322333908ce17adb0885/dicts/zi.dict.yaml) | 提交 `429bca38cec288ca9f6c322333908ce17adb0885`；`sources/wanxiang/` | 单字带调读音补充，忽略输入法权重和辅助码 |

Unicode 资料另附 [版本说明](https://www.unicode.org/versions/Unicode18.0.0/) 和 [UAX #38 修订 41](https://www.unicode.org/reports/tr38/tr38-41.html)，后者原件保存在 `sources/unicode-18.0.0/tr38-41.html`。收字使用原始 UCD，避免受运行时内置 Unicode 版本影响。

`pinyin-data` 所据 Unihan 为 17.0.0，因此另外接入 18.0.0 原件的 `kMandarin`、`kTGHZ2013`、`kHanyuPinyin`、`kXHC1983`、`kHanyuPinlu`、`kSMSZD2003Readings`；后者只取「粵」前的普通话。默认读音优先采用上游综合表，其后为当前 Unihan、底层词典及全字库、汉典、CC-CEDICT、万象。`overwrite.txt` 的明确纠错限制该字允许的读音，排除项仍保留在证据中。

全字库的第 2 列是汉语拼音，其他列不能混作汉语拼音。其数字表省略数字表示**一声**；普通带调字母词库省略调号表示轻声，两者分别处理。数字表中的 `jun2/3/4` 被上游误存成日期形式时，按同一注音查官方 `CNS_pinyin_2.txt` 回退，原始异常仍保留。

全字库仍使用 PUA 的字符，借助 Unihan 18.0 的规范 `kIRG_TSource` 连接到已编码汉字。T 源字面号为十六进制，CNS 文件中为十进制；既有非 PUA 码点发生对应差异时单独审计，不自动替换。下载官方包前核对格式用的 [公开镜像快照](https://github.com/yintzuyuan/CNS11643-OpenData/tree/27a0ea7451215a4b4e5bad0fa1640977630e4b00) 也保存于 `sources/cns11643-mirror/`，实际构建使用官方包。

本表采用已发布的带调文本资料，未对汉典逐字网页作全站抓取，也不借助无声调转换库猜测声调。当前读音覆盖率仅反映现有来源，可继续接入新资料。

## 署名与许可

本项目对原始资料作格式转换、数字声调规范化、去重、来源连接和覆盖率统计。使用或分发衍生数据时，请保留相应来源署名和许可文本；各来源及衍生部分保留其原有许可。

| 来源 | 署名与许可 |
|---|---|
| Unicode UCD / Unihan | Copyright © 1991–2026 Unicode, Inc.；Unicode License v3，原文在 `sources/unicode-18.0.0/LICENSE.txt` |
| CNS11643 全字库 | **數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw**；选用「政府资料开放授权条款第 1 版」，原文在 `sources/cns11643/LICENSE-government.html`，另有[官方授权说明](https://www.cns11643.gov.tw/pageView.jsp?ID=59) |
| pinyin-data | Copyright (c) 2016 mozillazg；MIT，原文在 `sources/pinyin-data/LICENSE`；各转录的进一步出处见上游 README 和文件注释 |
| CC-CEDICT | CC-CEDICT contributors，MDBG / cc-cedict.org；原库 CC BY-SA 4.0，见[原始发布说明](https://www.mdbg.net/chinese/dictionary?page=cedict)；保留由 pinyin-data 发布的单字转录 |
| 万象单字表 | amzxyz 及 rime-wanxiang / rime-wanxiang-data contributors；CC BY 4.0，原文在 `sources/wanxiang/LICENSE` |
