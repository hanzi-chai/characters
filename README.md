# Unicode 18.0 拼音表

基于 Unicode 18.0.0 原件整理逐字符拼音，缺失读音记为 `?`。项目使用 TypeScript / Bun；下载原件保存在 `sources/`，生成数据保存在 `data/`，均不纳入 Git。

## 使用

需要 Bun ≥ 1.3.0 和系统 `unzip`，无第三方运行时依赖。

```sh
bun run download
bun run build
```

下载默认复用缓存；`bun run download --refresh` 更新全部来源，也可在其后指定一个或多个 `sources/...` 路径。构建读取本地原件，并更新本 README 的覆盖率区段。

网页采集以构建结果中的缺音字符为目标：

```sh
bun run collect:web --source=yedict-index
bun run collect:web --source=yedict
bun run collect:web --source=zitools-index
bun run collect:web --source=zitools --targets=data/web-collection/zitools-candidates.json
bun run build
```

`--source=zitools` 不指定 `--targets` 时扫描全部当前缺音字符。采集可中断后续跑，复用已有原件及 400 / 404 响应缓存；支持 `--cached-only`、`--concurrency=1..8`（默认 4）、`--interval-ms=毫秒`（至少 25，默认 75）、`--limit=数量` 和 `--targets=码点数组JSON`。原件及索引保存在 `sources/`，候选码点写入 `data/web-collection/`。

开发时运行 `bun install` 安装开发依赖，`bun run check` 检查类型、代码规范和格式，`bun run format` 统一格式。

## 自动发布

向远端推送八位纯数字日期标签（`YYYYMMDD`，例如 `20261025`）会触发 [发布工作流](.github/workflows/release.yml)。标签必须是有效的公历日期，同一天使用一个标签，不覆盖已发布版本。

```sh
git push origin main
git tag -a 20261025 -m "20261025"
git push origin 20261025
```

CI 使用 Bun 1.3.14，安装锁定的开发依赖，通过代码检查后下载原件并构建，自动创建 [GitHub Release](https://github.com/hanzi-chai/characters/releases)。附件包括 `pinyin.tsv`、`evidence.jsonl`、`coverage.json` 和构建后含覆盖率、来源及许可说明的 `README.md`，均直接上传，不生成发布压缩包。附件全部上传成功后才公开发布；中途失败可在 Actions 中重新运行以续传草稿。

CI 从全新下载的原件构建，不自动执行网页增量采集，因此发布覆盖率可能与本地不同，以该版本的 `coverage.json` 和 README 为准。`sources/`、`data/`、`dist/` 始终不纳入 Git；工作流使用 GitHub 自动提供的 `GITHUB_TOKEN`，无需额外配置密钥。

## 输出与读音规则

| 文件 | 内容 |
|---|---|
| `data/pinyin.tsv` | `codepoint`、`char`、`pinyin`、`status`、`block`、`sources` 六列，按码点升序排列 |
| `data/evidence.jsonl` | 每字符的读音及证据：来源、原始读音、文件位置、CNS / Unicode 连接依据；网页字段用 JSON Pointer 定位，扫描件用页码和表内序号 |
| `data/coverage.json` | 总体、区块及来源统计 |

- 声调使用 `1`–`4`，轻声使用 `5`；`ü` 写作 `v`，保留 `ê`。
- 同字多音用逗号分隔，一字多音节用连字符连接，如 `瓩 → qian1-wa3`。
- 读音按 Unihan、CNS 全字库、教育部草案、汉典、CC-CEDICT、字海、字统网的优先级去重排列，保留来源异读，不处理词语中的多音字消歧。
- 缺少直接读音时，仅按 UnicodeData 的单个统一汉字分解补音，如 `⼀ → 一`；不从外观、简繁关系、声旁或多字分解推音，也不从无声调资料猜声调。

`status` 的取值为 `direct`（直接收录）、`unicode-decomposition`（分解补音）或 `missing`（缺音，`pinyin` 为 `?`）。

## 字符范围与覆盖率

依据本地 `UnicodeData.txt` 和 `Blocks.txt` 确定区块范围及已分配字符：统一表意文字及其扩展、部首、笔画、兼容表意文字区块全部收录；中日韩符号和标点、中日韩带圈字母和月份、中日韩带圈文字补充三个区块部分收录，具体码点在 [src/unicode.ts](src/unicode.ts) 中显式列出，包括「〇」、苏州码子、括号及带圈汉字、汉字月份与年号等。标点、韩文、假名、阿拉伯数字及拉丁字母符号不在应收录范围内。`PropList.txt` 的 `Unified_Ideograph` 属性用于限定单字分解补音的目标。

主表及缺音检查仅包含应收录字符，不因当前是否已取得读音而改变收录范围。下表「已分配字符」统计整个区块，「应收录字符」统计实际目标；全部收录的区块两者相等，部分收录的区块后者较少。读音覆盖率为有读音字符数除以应收录字符数，缺失数也只在应收录范围内计算。

以下统计由 `bun run build` 更新。

<!-- coverage:start -->

统计仅反映本地已取得的资料，网页采集未必覆盖全部字符。

应收录字符总数 **103,542**；有读音 **81,651**（78.86%）；缺失 **21,891**，记作 `?`。构建日期：2026-10-25。

直接来源 80834 字符；Unicode 分解补音 817 字符；多读音 24199 字符；仅补充来源收录 2205 字符。

| 区块 | 码点范围 | 已分配字符 | 应收录字符 | 有读音 | 缺失 | 读音覆盖率 |
|---|---|---:|---:|---:|---:|---:|
| 中日韩部首补充 | U+2E80–U+2EFF | 115 | 115 | 4 | 111 | 3.48% |
| 康熙部首 | U+2F00–U+2FDF | 214 | 214 | 214 | 0 | 100.00% |
| 中日韩符号和标点 | U+3000–U+303F | 64 | 13 | 13 | 0 | 100.00% |
| 中日韩笔画 | U+31C0–U+31EF | 39 | 39 | 0 | 39 | 0.00% |
| 中日韩带圈字母和月份 | U+3200–U+32FF | 255 | 102 | 53 | 49 | 51.96% |
| 中日韩统一表意文字扩展 A | U+3400–U+4DBF | 6592 | 6592 | 6589 | 3 | 99.95% |
| 中日韩统一表意文字 | U+4E00–U+9FFF | 20992 | 20992 | 20971 | 21 | 99.90% |
| 中日韩兼容表意文字 | U+F900–U+FAFF | 472 | 472 | 464 | 8 | 98.31% |
| 中日韩带圈文字补充 | U+1F200–U+1F2FF | 64 | 60 | 45 | 15 | 75.00% |
| 中日韩统一表意文字扩展 B | U+20000–U+2A6DF | 42720 | 42720 | 42696 | 24 | 99.94% |
| 中日韩统一表意文字扩展 C | U+2A700–U+2B73F | 4160 | 4160 | 4128 | 32 | 99.23% |
| 中日韩统一表意文字扩展 D | U+2B740–U+2B81F | 223 | 223 | 215 | 8 | 96.41% |
| 中日韩统一表意文字扩展 E | U+2B820–U+2CEAF | 5774 | 5774 | 2065 | 3709 | 35.76% |
| 中日韩统一表意文字扩展 F | U+2CEB0–U+2EBEF | 7473 | 7473 | 376 | 7097 | 5.03% |
| 中日韩统一表意文字扩展 I | U+2EBF0–U+2EE5F | 622 | 622 | 184 | 438 | 29.58% |
| 中日韩兼容表意文字补充 | U+2F800–U+2FA1F | 542 | 542 | 542 | 0 | 100.00% |
| 中日韩统一表意文字扩展 G | U+30000–U+3134F | 4939 | 4939 | 657 | 4282 | 13.30% |
| 中日韩统一表意文字扩展 H | U+31350–U+323AF | 4192 | 4192 | 1209 | 2983 | 28.84% |
| 中日韩统一表意文字扩展 J | U+323B0–U+3347F | 4298 | 4298 | 1226 | 3072 | 28.52% |

同一字符可以被多个来源收录，以下数字不能相加。统计包含分解补音后的归属，可能高于原始文件行数。

| 来源 | 字符数 | 不同字音对 |
|---|---:|---:|
| CC-CEDICT:headword | 15157 | 16744 |
| CNS11643:phonetic | 79203 | 98140 |
| MOE:ja-hanzi-draft | 33 | 33 |
| Unihan18:kHanyuPinlu | 4315 | 4972 |
| Unihan18:kHanyuPinyin | 34885 | 46167 |
| Unihan18:kSMSZD2003Readings | 8784 | 10082 |
| Unihan18:kTGHZ2013 | 8594 | 9353 |
| Unihan18:kXHC1983 | 11721 | 13296 |
| yedict:explicit-pinyin | 1514 | 1593 |
| zdic:pinyin-index | 54530 | 63607 |
| zitools:explicit-pinyin | 24 | 24 |


<!-- coverage:end -->

## 来源、处理与许可

下载地址、Unicode 版本及 CNS 镜像固定提交见 [src/sources.ts](src/sources.ts)；其他下载地址可随上游更新。原件和许可文本保存在本地 `sources/`。本项目对资料作读音提取、格式转换、去重和来源连接；使用或分发衍生数据时须保留相应署名及许可。

| 来源 | 使用内容与原件位置 | 署名与许可 |
|---|---|---|
| Unicode UCD / Unihan | `sources/unicode-18.0.0/`：字符范围、读音、T 源对应及分解 | Copyright © 1991–2026 Unicode, Inc.；Unicode License v3，见目录内 `LICENSE.txt` |
| CNS11643 全字库 | `sources/cns11643/`：官方 Unicode、注音与汉语拼音表 | 數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw；政府資料開放授權條款第 1 版，见目录内 `LICENSE.html`、`LICENSE-government.html` |
| CC-CEDICT | `sources/cc-cedict/cedict_ts.u8`：繁简词头均为单字的条目 | CC-CEDICT contributors，MDBG / cc-cedict.org；CC BY-SA 4.0，见目录内 `LICENSE.txt` 及原库文件头 |
| 汉典拼音索引 | `sources/zdic/*.html`：带调拼音分组下的单字 | 汉典 ZDIC.NET；网站条款保存在 `sources/zdic/terms.html` |
| 教育部《日本汉字的汉语读音规范（草案）》 | `sources/moe/japanese-kanji.pdf` 第 4–5 页；[src/moe.ts](src/moe.ts) 转录 32 个字音 | 教育部；仓库未收录单独的开放数据许可 |
| 字海／叶典 | `sources/yedict/U*.json`：本字现代、古代汉语释义中的明确带调拼音 | 字海／叶典及其编纂者；仓库未收录字音数据的开放许可 |
| 字统网 | `sources/zitools/U*.json`：本字直接官话记录及中文词典明确注音 | 字统网及各词典编纂者；仓库未收录字音数据的开放许可，IDS 数据的 MIT 许可不适用于字音 |

Unihan 使用 `kTGHZ2013`、`kHanyuPinyin`、`kXHC1983`、`kHanyuPinlu`、`kSMSZD2003Readings`，最后一项只取「粵」前的普通话。CNS 按字码连接 Unicode、注音和汉语拼音；数字拼音省略数字表示一声，损坏记录按同一注音回退到官方带调字母表，普通带调字母词库省略调号表示轻声。CNS 的 PUA 对应通过 `kIRG_TSource` 补接已编码汉字；下载的 CNS 镜像仅供参考，构建使用官方包。

汉典按原站读音分组提取，不从无调目录猜音；CC-CEDICT 不拆分多字词。字海和字统网只采用本字的直接汉语读音，不沿异体或相关节点补音。具体提取和合并规则见 [src/readings.ts](src/readings.ts) 及对应来源模块。
