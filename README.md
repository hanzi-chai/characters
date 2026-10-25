# Unicode 18.0 拼音表

以 Unicode 18.0.0 正式数据为基础，逐字符整理带数字声调的拼音，无法取得读音时记作 `?`。原始资料、逐条来源证据和处理脚本均可在本地保留及复现。

仓库追踪 TypeScript / Bun 代码、配置、来源锁文件和说明；下载原件（`sources/`）和生成数据（`data/`）保存在本地，不纳入 Git。

## 使用

需要 Bun（已使用 1.4.3 验证），以及系统 `tar`、`unzip`；无第三方运行时依赖，无需 `bun install`。

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

# 以当前缺失读音的字符为目标，筛选、下载两站的直接读音
bun run collect:web --source=yedict-index
bun run collect:web --source=yedict
bun run collect:web --source=zitools-index
bun run collect:web --source=zitools --targets=data/web-collection/zitools-candidates.json

# 进一步扫描字统网完整释义；可中断、续跑，默认 4 并发
bun run collect:web --source=zitools
# 仅登记本地缓存，不发网络请求
bun run collect:web --source=zitools --cached-only
# 采集后重新生成统计并核验
bun run build
bun run check
bun run repro
```

下载默认检查 `sources.lock.json` 中的 SHA-256。上游可变 URL 更新时会拒绝不匹配的文件；确认要采用新版本后，执行 `bun run download --refresh`，再重新构建和核验。

网页采集原件保存在 `sources/yedict/`、`sources/zitools/`，成功条目逐文件加入锁文件；`download` 会恢复锁内所有条目。候选索引原件另存于 `sources/*-index/`，它们只用于缩小检索范围，不参与读音构建。采集支持 `--concurrency=1..8`、`--interval-ms=毫秒`、`--limit=数量` 和 `--targets=码点数组JSON`；限制并发、请求超时及退避重试，收到 429 / 503 时延后请求。进度及失败记录保存在 `data/web-collection/`；每 30 秒和正常中断时保存锁文件，续跑使用已下载原件及 400 / 404 缓存。首次尝试取得锁内可变网页时，上游变化仍会触发校验失败，离线复现应保留本地原件。

## 字符范围与覆盖率

主表包含 `Unified_Ideograph` 属性的全部字符、`U+3007`「〇」，以及下表中标为「整块收录」的八个区块的**全部已分配字符**，去重后按码点升序排列。

原有汉字范围共 103,000 字（含 1,014 个兼容表意文字及「〇」），新增相关区块字符 750 个。两个兼容表意文字区块已在原有范围中，不重复计数。包括统一汉字扩展 A–J、Unicode 18.0 新增的 `U+2B81E`，不收录区块内未分配码点、私用区、变体选择符及独立的小篆、女真文字。

这些区块也包含标点、韩文字母、假名和其他符号；收录它们并不表示它们都存在普通话读音，无法取得读音时同样保留 `?`。标点取字符自身的读音，不把符号名称当作拼音。

以下统计由 `bun run build` 随拼音表一起更新。

<!-- coverage:start -->

字符总数 **103,750**；有读音 **83,285**（80.2747%）；缺失 **20,465**，记作 `?`。来源快照日期：2026-10-22。

直接来源 82468 字符；Unicode 分解补音 817 字符；多读音 22772 字符；仅补充来源收录 1610 字符。

| 区块 | 码点范围 | 整块收录 | 已分配字符 | 有读音 | 缺失 | 读音覆盖率 |
|---|---|---|---:|---:|---:|---:|
| 中日韩部首补充 | U+2E80–U+2EFF | 是 | 115 | 3 | 112 | 2.6087% |
| 康熙部首 | U+2F00–U+2FDF | 是 | 214 | 214 | 0 | 100% |
| 中日韩符号和标点 | U+3000–U+303F | 是 | 64 | 4 | 60 | 6.25% |
| 中日韩笔画 | U+31C0–U+31EF | 是 | 39 | 0 | 39 | 0% |
| 中日韩带圈字母和月份 | U+3200–U+32FF | 是 | 255 | 53 | 202 | 20.7843% |
| 中日韩统一表意文字扩展 A | U+3400–U+4DBF | — | 6592 | 6589 | 3 | 99.9545% |
| 中日韩统一表意文字 | U+4E00–U+9FFF | — | 20992 | 20966 | 26 | 99.8761% |
| 中日韩兼容表意文字 | U+F900–U+FAFF | 是 | 472 | 464 | 8 | 98.3051% |
| 中日韩带圈文字补充 | U+1F200–U+1F2FF | 是 | 64 | 45 | 19 | 70.3125% |
| 中日韩统一表意文字扩展 B | U+20000–U+2A6DF | — | 42720 | 42696 | 24 | 99.9438% |
| 中日韩统一表意文字扩展 C | U+2A700–U+2B73F | — | 4160 | 4129 | 31 | 99.2548% |
| 中日韩统一表意文字扩展 D | U+2B740–U+2B81F | — | 223 | 216 | 7 | 96.861% |
| 中日韩统一表意文字扩展 E | U+2B820–U+2CEAF | — | 5774 | 2478 | 3296 | 42.9165% |
| 中日韩统一表意文字扩展 F | U+2CEB0–U+2EBEF | — | 7473 | 421 | 7052 | 5.6336% |
| 中日韩统一表意文字扩展 I | U+2EBF0–U+2EE5F | — | 622 | 271 | 351 | 43.5691% |
| 中日韩兼容表意文字补充 | U+2F800–U+2FA1F | 是 | 542 | 542 | 0 | 100% |
| 中日韩统一表意文字扩展 G | U+30000–U+3134F | — | 4939 | 1752 | 3187 | 35.4728% |
| 中日韩统一表意文字扩展 H | U+31350–U+323AF | — | 4192 | 1246 | 2946 | 29.7233% |
| 中日韩统一表意文字扩展 J | U+323B0–U+3347F | — | 4298 | 1196 | 3102 | 27.8269% |

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
| yedict:explicit-pinyin | 1514 | 1593 |
| zitools:explicit-pinyin | 97 | 97 |

未接受的原始读音记录 267 条，含已由另一官方表成功回退的异常数字拼音，不代表同字最终缺音。17373 个字符的来源读音集合不同，可能出于收录详略、古今或地区差异。CNS / Unihan 的 12 处既有码点映射差异保留在审计文件中。

<!-- coverage:end -->

## 拼音与输出格式

- 声调用 `1`–`4`，轻声用 `5`：`zhang1`、`le5`。
- `ü` 写作 `v`：`女 → nv3`、`绿 → lv4,lu4`；`ê` 保留为 `ê2` 等形式，输出不完全限于 ASCII。
- 同字多音用逗号分隔；少数一字多音节用连字符连接，如 `瓩 → qian1-wa3`。
- 保留来源收录的古音、异读和地区差异，默认读音是来源优先级产生的回退值，不负责词语中的多音字消歧。
- 仅按 Unicode 明确给出的**单个统一汉字分解**为缺音字符补音，包括兼容字、部首和带圈字等；例如 `⼀ → 一`、`㊤ → 上`。不由外观近似、声旁或简繁关系猜音，也不将多字分解机械拼成读音。

所有生成文件位于本地 `data/`：

| 文件 | 内容 |
|---|---|
| `pinyin.tsv` | 码点、字符、全部读音、默认读音、状态、中文区块名、来源；缺失读音为 `?` |
| `evidence.jsonl` | 每字符逐条原始读音、来源文件、行号及 CNS / Unicode 连接依据 |
| `coverage.json` | 区块及来源的机器可读统计；可读报告直接显示在本 README |
| `rejected-readings.jsonl` | 无法采用的原始记录，包含已由另一官方表成功回退的异常 |
| `cns-mapping-conflicts.json` | CNS / Unihan 既有码点映射差异 |
| `manifest.json` | 生成数据文件的 SHA-256 |

`direct` 表示来源直接收录；`unicode-decomposition` 表示依据 Unicode 分解补音；`missing` 表示读音为 `?`。

## 数据来源与处理

构建采用的原始 URL、字节数、SHA-256 逐文件记录于 [sources.lock.json](sources.lock.json)；下载入口及固定版本记录于 [src/sources.ts](src/sources.ts)。原件、压缩包和上游许可证均保存到本地 `sources/`。下载锁仅包含配置的下载及其解压原件；留在 `sources/` 中的候选来源调查副本不自动参与锁定或构建。处理过程只运行 TypeScript / Bun；上游原件中自带的 Python 脚本仅作原件保留。

| 来源 | 固定版本与原件 | 用途 |
|---|---|---|
| [Unicode UCD / Unihan](https://www.unicode.org/Public/18.0.0/ucd/) | Unicode 18.0.0 正式版；`sources/unicode-18.0.0/` | 字符范围、普通话字段、T 源对应、Unicode 分解 |
| [数位发展部 CNS11643 全字库](https://data.gov.tw/dataset/5961) | 20260805；`sources/cns11643/Properties.zip`、`MapingTables.zip`、`release.txt` | CNS → Unicode、CNS → 注音、注音 → 汉语拼音 |
| [mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data/tree/9e5e9bdfe8add694300e0cc93a27b803b68377f9) | 提交 `9e5e9bdfe8add694300e0cc93a27b803b68377f9`，0.15.0；完整上游包与原文件 | 综合字音、8105 字常用音、人工纠错、汉典及 CC-CEDICT 单字转录 |
| [万象带调单字表](https://github.com/amzxyz/rime-wanxiang/blob/429bca38cec288ca9f6c322333908ce17adb0885/dicts/zi.dict.yaml) | 提交 `429bca38cec288ca9f6c322333908ce17adb0885`；`sources/wanxiang/` | 单字带调读音补充，忽略输入法权重和辅助码 |
| [字海／叶典](http://yedict.com/) | 2026-10-22；`sources/yedict/U*.json`，1,548 个完整条目 | 从字符自身的现代／古代汉语释义提取明确带调拼音 |
| [字统网](https://zi.tools/) | 2026-10-22；`sources/zitools/U*.json`，661 个完整条目 | 字符自身的官话记录、明确汉语读音字段及中文词典字头注音；不沿关系图补音 |

Unicode 资料另附 [版本说明](https://www.unicode.org/versions/Unicode18.0.0/) 和 [UAX #38 修订 41](https://www.unicode.org/reports/tr38/tr38-41.html)，后者原件保存在 `sources/unicode-18.0.0/tr38-41.html`。收字使用原始 UCD，避免受运行时内置 Unicode 版本影响。

`pinyin-data` 所据 Unihan 为 17.0.0，因此另外接入 18.0.0 原件的 `kMandarin`、`kTGHZ2013`、`kHanyuPinyin`、`kXHC1983`、`kHanyuPinlu`、`kSMSZD2003Readings`；后者只取「粵」前的普通话。默认读音优先采用上游综合表，其后为当前 Unihan、底层词典及全字库、汉典、CC-CEDICT、万象、字海、字统网。`overwrite.txt` 的明确纠错限制该字允许的读音，排除项仍保留在证据中。

全字库的第 2 列是汉语拼音，其他列不能混作汉语拼音。其数字表省略数字表示**一声**；普通带调字母词库省略调号表示轻声，两者分别处理。数字表中的 `jun2/3/4` 被上游误存成日期形式时，按同一注音查官方 `CNS_pinyin_2.txt` 回退，原始异常仍保留。

全字库仍使用 PUA 的字符，借助 Unihan 18.0 的规范 `kIRG_TSource` 连接到已编码汉字。T 源字面号为十六进制，CNS 文件中为十进制；既有非 PUA 码点发生对应差异时单独审计，不自动替换。下载官方包前核对格式用的 [公开镜像快照](https://github.com/yintzuyuan/CNS11643-OpenData/tree/27a0ea7451215a4b4e5bad0fa1640977630e4b00) 也保存于 `sources/cns11643-mirror/`，实际构建使用官方包。

本表采用已发布的带调文本资料，未对汉典逐字网页作全站抓取，也不借助无声调转换库猜测声调。当前读音覆盖率仅反映现有来源，可继续接入新资料。

字海先核对 ZIID 和字形并拒绝跳转，只读字符自身的 `meanings.mean_h`（现代汉语）及 `mean_g`（古代汉语）；`mean_z` 是壮语，不能误当成「中华字海」。提取「拼音／读音」后的列表及字头、分行开头的直接注音，必须有数字声调或调号。比如 `拼音lan、lang、dian3` 只采用 `dian3`，`pou3she3` 规范为 `pou3-she3`；`sie44` 等调值转写、无调音节、明确写着「拟定读音」等推测均不采用。两分部件、讨论、外语及实际方言转写不参与补音，方言用字如另有明确汉语拼音则可收录。

字统网核对请求字形和记录字形，只读本字的 `yin.zibokrows[字].cn` 及 `row_node_id_list` 中字形一致的词典行。官话记录的 `path`、`phos` 必须为空；不从异体、声旁或相关节点继承。词典行的 `cn:` 字段明确标示汉语读音，未标语言的字头注音仅采用已识别的中文词典来源（全字库字条、中华字海、汉语大字典、康熙字典、说文及本站条目），排除方言、日韩、越南和壮语词典的未标语言转写。旧 CNS 字条中只有 `mou3 …用字` 的泛化说明暂存待核，不据此增补。两站证据均保留原始 JSON 的行号、JSON Pointer、URL、日期及 SHA-256，可逐条回到原字段。

2026-10-22 批量增补以此前 22,019 个缺音字符为目标。叶典遍历 453 个拼音检索项、571 页结果，筛出 1,546 个缺音候选并取得全部条目，加上原有 2 个条目，最终 1,514 字有可采用的直接读音。字统网通过 221 次分组查询覆盖全部缺音字符，筛出 68 个直接官话候选，另有 1,438 条带关系路径的记录未直接采用；再下载候选及抽样、顺序扫描取得的完整条目。逐字接口随后持续超时，完整释义扫描**尚未遍历全部缺音字符**；已有 661 个成功响应锁定，97 字提供有效读音。两站去重后，本轮净补 1,554 字，覆盖率由 78.7769% 提高至 80.2747%；释义扫描可用上述命令继续，不将未完成部分记作无读音。

### 魔然引用来源的核查

2026-10-22 核查 [rime-moran](https://github.com/rimeinn/rime-moran/tree/8526bf134b1ddbf14ffc5e19d05d971fa4680bdd) 的底表、参考资料及提交中注明的来源。以下是对当前主表的增补价值，数量不表示原库准确率。

| 候选来源与核查版本 | 核查结果与采用情况 |
|---|---|
| [rime-zrm](https://github.com/bigshans/rime-zrm/tree/4ef9a1d595cdf01c9c32f0655f165dc62d15d8dd)；[明月拼音](https://github.com/rime/rime-luna-pinyin/tree/56b934b099dfbeab842320f13aa8b461a6ab3e42)；[八股文](https://github.com/rime/rime-essay/tree/054920de4f54c9e5994276a96a4fc2a35cb51aa3) | 自然码／无调拼音或字词频，不能恢复声调；不接入字音主表。 |
| [character_set](https://github.com/rime-aca/character_set)；[cjktables](https://github.com/ButTaiwan/cjktables)；《通用规范汉字表》 | 属于字集、字形和编码参考，不能为现有缺音字提供直接声调证据；字符范围仍以本项目的 UCD 为准。 |
| [THUOCL-pinyin](https://github.com/ksqsf/THUOCL-pinyin/blob/master/process.py)；[白霜／雾凇输入法字表](https://github.com/gaboolic/rime-frost/blob/master/cn_dicts/8105.dict.yaml) | 所查 THUOCL 脚本用 pypinyin 生成无调词音，白霜字表也为无调形式；不作为独立带调单字来源。魔然致谢中的萌娘、音乐和日语等词库用于词语及混输，未据此逐字分摊读音。 |
| [文书 DB](https://github.com/LemonHX/wenshudb/tree/52519289e9d1b77b8397de5b0f80f83bf5a64724) | 原始 `unihan/readings.csv` 的 Mandarin、HanyuPinyin、HanyuPinlu、XHC1983 字段没有覆盖当前缺音字。生成 SQLite 的脚本还调用 pypinyin 扩充读音；不把成品数据库当作独立字音证据，也不以旧字段覆盖现有校订。 |
| [chinese-xinhua](https://github.com/pwxcoo/chinese-xinhua/tree/fe6d6c2e8baa82187f4c96bbe042e43f96c05666) | `word.json` 有 16,142 条记录、14,810 个不同字符，没有覆盖当前缺音字。带调字段存在明显错配，如「歡」标 `āi`，同一条「宀」的拼音字段为 `bǎo`、释义却为 `mián`；不自动并入异读。 |
| [《日本汉字的汉语读音规范（草案）》](https://www.moe.gov.cn/ewebeditor/uploadfile/2015/01/13/20150113090951346.pdf) | 已逐页核对 32 字读音表，现有 `pinyin-data/kanji.txt` 已转录，重复引入没有增量。「簗」「麿」的草案音分别为 `liáng`、`mó`，仍按现有 `overwrite.txt` 的明确纠错处理，排除的证据保留。仅使用表中明确列出的字音，不运行草案中的声旁、形近和简繁拟音规则。 |
| [《辞源》](https://www.cp.com.cn/Content/2016/05-16/1513152084.html) | 官方数字版为付费数据库；本次未找到公开、可复现的带调数据下载。魔然据《辞源》补入的 1,471 条记录已去调，不能据此还原声调；暂不接入。 |
| [字统网](https://zi.tools/)；[yi-bai/ids](https://github.com/yi-bai/ids) | 已接入公开接口的本字官话及中文词典直接带调读音，批量范围见上文。MIT 的 IDS 库只提供拆分，不提供读音；字统网读音资料未据此获得 MIT 许可，也不沿异体关系补音。 |
| [字海／叶典](http://yedict.com/) | 已接入拼音索引筛选及完整字条批量解析，批量范围见上文。「𬺳」仅指向「万」、「㦳」无直接普通话音、「𲾚」列方言 `sie44`，均不推导主表读音。 |

魔然与原主表比较所得 11,193 个缺音候选不能视作等量可补普通话音：其中混有无调读音、方言及按异体或声旁处理的输入法用音。后续扩充仍需逐字取得直接带调证据。

## 署名与许可

本项目对原始资料作格式转换、数字声调规范化、去重、来源连接和覆盖率统计。使用或分发衍生数据时，请保留相应来源署名和许可文本；各来源及衍生部分保留其原有许可。

| 来源 | 署名与许可 |
|---|---|
| Unicode UCD / Unihan | Copyright © 1991–2026 Unicode, Inc.；Unicode License v3，原文在 `sources/unicode-18.0.0/LICENSE.txt` |
| CNS11643 全字库 | **數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw**；选用「政府资料开放授权条款第 1 版」，原文在 `sources/cns11643/LICENSE-government.html`，另有[官方授权说明](https://www.cns11643.gov.tw/pageView.jsp?ID=59) |
| pinyin-data | Copyright (c) 2016 mozillazg；MIT，原文在 `sources/pinyin-data/LICENSE`；各转录的进一步出处见上游 README 和文件注释 |
| CC-CEDICT | CC-CEDICT contributors，MDBG / cc-cedict.org；原库 CC BY-SA 4.0，见[原始发布说明](https://www.mdbg.net/chinese/dictionary?page=cedict)；保留由 pinyin-data 发布的单字转录 |
| 万象单字表 | amzxyz 及 rime-wanxiang / rime-wanxiang-data contributors；CC BY 4.0，原文在 `sources/wanxiang/LICENSE` |
| 字海／叶典字音 | 字海／叶典及其编纂者，原字条如 [鿊](http://yedict.com/z/U09FCA)、[𫠡](http://yedict.com/z/U2B821)，每条原始 API URL 见锁文件。本次未发现网站声明整库开放许可；保留原始响应及署名，不将其标作 MIT、CC BY 或其他开放许可数据。 |
| 字统网字音 | 字统网及各词典编纂者，每条 API URL 见锁文件，原始词典标识保留在证据 JSON Pointer 对应的条目中。本次未找到全库开放许可，不将本站 MIT 的 IDS 数据许可套用于字音；公开接口及本地留存不表示获得完整原件再分发许可。 |
