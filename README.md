# Unicode 18.0 全汉字带调拼音表

收录 **103,000 个字符**，逐字一行；**81,412 字有读音（79.0408%）**，**21,588 字为 `xxx`**。字符范围全部覆盖，读音仍有缺失。原始资料采集于 **2026-10-22**。

本仓库只追踪 TypeScript / Bun 源码、配置、来源锁文件和项目说明。下载原件（`sources/`）、生成数据（`data/`）、压缩包（`dist/`）及下载的网页均由 `.gitignore` 排除，保留在本地。首次克隆后先执行 `bun run download`，再执行 `bun run build`。

构建后生成的主要文件：

| 文件 | 内容 |
|---|---|
| `data/pinyin.txt` | 最简两列：`汉字<TAB>拼音`，无表头，多音用逗号分隔 |
| `data/pinyin-default.txt` | 两列，每字只取一个默认读音；缺失为 `xxx` |
| `data/pinyin.tsv` | 含表头的主表：码点、汉字、拼音、默认读音、状态、区块、来源 |
| `data/pinyin.json` | `汉字 → 拼音数组`，缺失值为 `["xxx"]` |
| `data/evidence.jsonl` | 每字的逐条来源、原始读音、文件与行号、全字库连接依据 |
| `data/missing.tsv` | 仍为 `xxx` 的完整清单 |
| `data/COVERAGE.md` | 各扩展区与来源的覆盖率 |

## 收字范围

主表取 Unicode 18.0.0 正式版的以下并集，去重后按码点升序排列：

1. `PropList.txt` 的 `Unified_Ideograph` 属性，共 101,997 字。
2. `UnicodeData.txt` 中名称以 `CJK COMPATIBILITY IDEOGRAPH-` 开头的已分配字符，共 1,014 字；其中 12 字与上项重叠。
3. `U+3007`「〇」。

因此为 `101997 + 1014 - 12 + 1 = 103000` 字。包括扩展 A–J，以及 Unicode 18.0 新增的 `U+2B81E`。不把区块内未分配码点、私用区、变体选择符算作汉字。部首、笔画、迭代符号等另收于 `data/related-han-symbols.tsv`，共 391 字符。小篆、女真文等独立文字不属于上述汉字集合。

核验脚本使用 **Unihan 全部八个文件的码点并集 + 〇** 进行第二次独立对照，确保没有遗漏或误收。

## 拼音格式

- 声调用 `1`–`4`；轻声用 `5`，例如 `zhang1`、`le5`。
- `ü` 写为 `v`：`女 → nv3`、`绿 → lv4,lu4`。`ê` 保留，例如 `ê2`；因此输出不完全限于 ASCII。
- 多音字以逗号分隔，保留来源收录的不同读音；包含古音、异读及地区差异，不能直接视作现代教学规范。
- 少数一字多音节的读法用连字符连接，如 `瓩 → qian1-wa3`；它是一条多音节读音。
- 没有可接受的带调读音时填 `xxx`。不由无声调输入法码表猜声调，也不按声旁、简繁关系猜音。
- 默认读音是来源优先级产生的回退值，不负责词语中的多音字消歧。

## 来源与处理

完整下载地址、提交号、SHA-256 随配置保留；下载脚本将原件和上游许可证保存到本地。详见 [research/SOURCES.md](research/SOURCES.md)、[sources.lock.json](sources.lock.json) 和 [NOTICE.md](NOTICE.md)。

| 来源 | 本地保存 | 用途 |
|---|---|---|
| Unicode 18.0 UCD / Unihan | `sources/unicode-18.0.0/`，含原始 `Unihan.zip` | 字符范围、普通话字段、T 源对应、兼容字规范分解 |
| 数位发展部 CNS11643 全字库，20260805 | `sources/cns11643/`，含原始 `Properties.zip`、`MapingTables.zip` | 注音 → 官方汉语拼音、CNS → Unicode |
| mozillazg/pinyin-data，固定提交 | `sources/pinyin-data/`，含上游完整压缩包及原文件 | 综合字音、8105 字常用音、人工纠错、汉典与 CC-CEDICT 转录 |
| amzxyz/rime-wanxiang，固定提交 | `sources/wanxiang/` | 带调单字表补充 |

处理规则：

1. 从原始 UCD 文件枚举字符，不使用 Bun/操作系统内置的 Unicode 版本判断范围。
2. 分别解析 Unihan 的 `kMandarin`、`kTGHZ2013`、`kHanyuPinyin`、`kXHC1983`、`kHanyuPinlu`、`kSMSZD2003Readings`。后者只取「粵」前的普通话字段。
3. 合并已发布的单字拼音资料，按读音去重。默认次序优先采用 `pinyin-data/pinyin.txt`，之后是当前 Unihan、底层词典及全字库、汉典、CC-CEDICT、万象。上游 `overwrite.txt` 的明确纠错限制该字允许的读音，排除记录仍保留于 `excludedByCorrection`。
4. 全字库通过「CNS 码 → Unicode」「CNS 码 → 注音」「注音 → 汉语拼音」连接，三个位置都记录文件和行号。它的数字拼音表省略声调数字表示 **一声**；其他带调字母词库中不带调号表示轻声，二者分别处理。
5. 全字库仍使用 PUA 的字符，通过 Unicode 18.0 规范的 `kIRG_TSource` 对应到已编码汉字。T 源字面号是十六进制，全字库字面号是十进制。12 处已有非 PUA 码点对应不同的情况单独审计，保留全字库的既有映射，不自动替换。
6. 数字拼音表中 `jun2/3/4` 被上游误存为 `2-Jun/3-Jun/4-Jun`。遇到这种不能解析的数据，按相同注音查另一份官方 `CNS_pinyin_2.txt` 回退，保留异常记录。
7. 兼容汉字自身无音时，只按 `UnicodeData.txt` 的单码点规范分解补音，状态为 `unicode-decomposition`。主表有 501 字通过此方式补音。
8. 使用显式音节清单过滤混入的外语转写与损坏内容，保留明确来源中的罕见汉语扩展音节；无把握的记录进入审计文件。

辅助审计文件：

- `data/source-disagreements.tsv`：来源间读音集合不同的汉字；集合不同可能只是收录详略或地区差异。
- `data/supplement-only.tsv`：仅由汉典、CC-CEDICT 或万象补充的 54 字。
- `data/rejected-readings.jsonl`：未接受的原始记录，含已成功回退的异常数字拼音；不代表同字最终缺音。
- `data/cns-mapping-conflicts.json`：12 处 CNS / Unihan 对应差异。
- `data/manifest.json`：所有生成数据文件的校验和。

## 运行与复现

实际构建和下载编程均为 **TypeScript / Bun**，没有第三方运行时依赖。上游快照中保留了它原有的 Python 脚本，本项目不执行这些脚本。已使用 Bun 1.4.2 验证；解压原始资料和打包需要系统 `tar`、`unzip`。

```sh
# 首次克隆：下载已记录的原件；无需 bun install
bun run download
bun run build
bun run check

# 原件已在本地时可离线重建
bun run build

# 用现有快照再次构建，检查所有生成文件字节一致
bun run repro

# 查字及逐条来源
bun run lookup 张行绿 U+33472
bun run lookup U+33472 --evidence

# 主动重新抓取上游可变 URL、更新锁文件
bun run download --refresh
bun run build
bun run check

# 打包含全部数据、原件、脚本、说明的压缩包
bun run package
```

已通过 6 项领域测试（46 个断言）及全表验证：103,000 字范围、排序去重、数字声调、JSON/TSV 一致、全部 516,877 条来源定位、其中 97,664 次 CNS 连接、原始文件及生成文件校验和。离线重复构建的全部数据文件一致。
