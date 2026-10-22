# Agent 开发说明

## 项目约定

- 编程使用 TypeScript / Bun；无第三方运行时依赖，不执行上游快照中的 Python 脚本。
- 读者需要的使用方式、来源、许可及覆盖率集中在根目录 README.md；不要恢复 research 目录或另建 COVERAGE.md、SOURCES.md、NOTICE.md。
- 原始下载仅放在 sources/，生成数据仅放在 data/，打包结果仅放在 dist/；这三个目录不纳入 Git，不得用 git add -f 绕过忽略规则。
- sources.lock.json 是要跟踪的来源配置，保留 URL、版本及 SHA-256。移动原件只改路径，不改原始字节或校验和。

## 代码位置与领域约束

- src/sources.ts 声明下载地址与固定提交；scripts/download.ts 下载并解压，完整原件和许可证留在 sources/。
- src/unicode.ts 的 includedBlocks 是八个额外区块的配置；范围依据下载的 Blocks.txt 与 UnicodeData.txt，只收录已分配字符，不使用运行时的 Unicode 属性正则代替原始数据。
- scripts/build.ts 合并读音与证据；多音按来源优先级去重，轻声用 5、ü 用 v、ê 保留，多音节用连字符。不能从无声调库猜声调。
- 无直接读音时，只允许按 UnicodeData 的单个统一汉字分解补音。不从 EquivalentUnifiedIdeograph 的外观近似、简繁关系、声旁或多字分解推导主表读音。
- CNS 数字拼音省略数字表示一声，普通带调字母词库省略调号表示轻声。CNS 的数字表损坏时用同注音的官方带调字母表回退，保留异常记录。
- kIRG_TSource 的字面号是十六进制，CNS 文件中的字面号是十进制；TU 不是 CNS 字码。保留 CNS 三次连接的全部原件位置。
- 不为绕过校验直接修改 SHA-256；查明上游变化后，按任务需要采用 --refresh 更新快照。

## 文档和核验

- scripts/build.ts 通过 src/report.ts 更新 README 的 coverage:start / coverage:end 区段；改统计模板后运行构建，勿手工维持重复统计表。
- data/coverage.json 是统计的机器可读来源；不再生成独立的可读覆盖率文件或相关符号分表，新增区块直接进入主表。
- 修改范围或读音逻辑后运行 bun run build、bun run check、bun run repro。verify.ts 用 Unihan 八个文件及独立码点范围作对照，并检查全部来源指针与 README 统计同步。
- 修改下载或路径时，使用已缓存原件运行 bun run download 验证锁文件及离线流程；修改打包时运行 bun run package 检查压缩包。
- 提交前运行 git diff --check，确认 git ls-files 中没有 sources/、data/、dist/ 文件。远端使用 SSH 别名 i：git@i:hanzi-chai/characters.git。
