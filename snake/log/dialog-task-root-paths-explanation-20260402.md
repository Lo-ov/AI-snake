# 对话整理：为何 `log` / `product` 等曾不在 `snake/` 下，以及规则如何修正

> 来源：用户与 Agent 的对话摘录整理（关于 `RD1.txt` 与 `.cursor` 规则中的目录基准）。

## 1. 为何之前 `log`、`product`、`code` 等没有生成在 `snake/` 下？

当时 `.cursor/rules` 里多处写的是 **“project root（项目根目录）”**，但**没有明确**“项目根目录 = 需求文档里声明的根目录”。

执行时 Agent 将 **project root** 按 **工作区根目录**理解（本仓库中为 `F:\AICode`），因此：

- `log/` → `F:\AICode\log`
- `product/` → `F:\AICode\product`
- 同理，`code/`、`plan/`、`res/` 等若按“工作区根”理解，也会落在 `F:\AICode\` 下

而 `RD1.txt` 明确写了：

> **以 snake 文件夹为根目录**

按该要求，上述目录应以 **`F:\AICode\snake`** 为基准生成，例如：

- `F:\AICode\snake\log`
- `F:\AICode\snake\product`
- `F:\AICode\snake\code`
- `F:\AICode\snake\plan`
- `F:\AICode\snake\res`

## 2. 已对 `.cursor` 规则做的调整（概要）

为与 `RD1.txt` 这类需求一致，规则中补充了 **Task root（任务根目录）** 定义：

- **Task root** = 需求中**显式声明**的根目录（例如“以 `snake` 文件夹为根目录”）
- 若需求**未声明**根目录，再回退为**工作区根目录**
- 规则中的 `log/`、`plan/`、`code/`、`product/`、`res/` 等路径，均视为 **相对 Task root**

涉及更新的规则/技能文件（路径均在工作区内）包括但不限于：

- `.cursor/rules/execution-logging.mdc`
- `.cursor/rules/plan-archiving-and-status.mdc`
- `.cursor/rules/code-artifacts.mdc`
- `.cursor/rules/product-artifacts.mdc`
- `.cursor/rules/project-resources-res.mdc`
- `.cursor/skills/project-resources-ingest/SKILL.md`（`res/` 相对 Task root）

## 3. 与 Snake 项目相关的 `res/` 示例

按 Task root = `snake/` 时，资源可落在例如：

- `snake/res/images/library/snake/bomb.png`

（具体以当次任务实际下载/拷贝结果为准。）

## 4. 之后执行时的预期行为

当需求像 `RD1.txt` 一样写明“以某文件夹为根目录”时，Agent 应把 `log`、`plan`、`code`、`product`、`res` 等**统一建在该根目录下**，而不是默认建在工作区根目录。

---

*本文件由 Agent 根据对话内容整理写入 `snake/log/`，便于留档与后续协作。*
