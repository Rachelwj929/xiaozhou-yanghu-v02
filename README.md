# 小周养护 V0.2

从 V0.1 提交 `2f74c67ac451d3d57402ed45861b8f8b8e68d058` 复制源码建立的独立 PWA。保留 React、TypeScript、Vinext/Vite、IndexedDB 和 GitHub Pages；依赖锁定版本未升级。

## 本地检查与构建

需要 Node.js 22.13 或以上（部署使用 Node 22）。

```sh
npm ci
npm run typecheck
npm run lint
npm run build
```

部署产物为 `dist/client`。默认子路径为 `/xiaozhou-yanghu-v02/`，工作流也明确使用此路径。静态预渲染会短暂监听本机端口。GitHub Pages 发布源设为 **GitHub Actions**，推送 `main` 后自动部署。

沿用 V0.1 的 Vinext 静态导出；仅移除与 GitHub Pages 无关、会复制旧 Site 身份文件的 Sites 发布插件调用，保留原依赖版本。

## 本版变更

- 早餐：VD 每天，早餐随餐（随蛋黄）；VC 每天，早餐后1颗。
- 午餐：VB 周一/三/五，午餐随餐；NAC 每天，午餐后1颗，保留换季备注。
- 晚餐：静脉曲张补剂每天，晚餐后1颗。
- 鱼油、镁、肌醇、橄榄油、椰子油、苹果醋的安排沿用 V0.1。
- 动物肝脏/VB 和海产品/鱼油联动保留。取消旧 VC、第二次 VC 和间隔提示。
- 身体记录改用 `bodyNotes` 多行文本；今天页的该字段写入昨天，历史详情写入所选日期。腹泻/肌醇保留条件性文字提醒，不分析自由输入。
- 返回按钮 88×48 CSS 像素；顶/侧/底部使用 safe-area；文本框 16px；主要记录按钮至少 44px 高。
- 添加指定的静态生活提醒。

## 数据和离线隔离

| 项目 | V0.1 | V0.2 |
| --- | --- | --- |
| IndexedDB | `xiaozhou-care` | `xiaozhou-care-v02` |
| 缓存 | `xiaozhou-care-v1` | `xiaozhou-care-v02-<内容哈希>` |
| SW scope | `/xiaozhou-yanghu/` | `/xiaozhou-yanghu-v02/` |
| JSON app / version | `xiaozhou-care` / 1 | `xiaozhou-care-v02` / 2 |
| 待写入草稿键 | 不使用 | `xiaozhou-care-v02-pending` |

V0.2 不打开、升级、删除 V0.1 数据库，不执行注销所有 SW 或清理所有缓存的操作。备份验证应用标识、版本、合法日期、字段、补剂键和状态；拒绝旧备份。同日期恢复以备份内容为准，其他日期保留。

输入先同步更新 React 和独立草稿，再按顺序写入 IndexedDB；切页不取消写入，刷新时恢复待写草稿。空记录不入库。读取失败时禁止编辑；写入失败显示持续提示，允许导出当前内存记录。

每次构建按产物内容生成新缓存标识，预缓存全部静态资源。更新等待旧页面关闭后激活，避免混用不同版本的 HTML/JS；只清理自己前缀的旧缓存。

**旧版的既有局限：** V0.1 原 Service Worker 在激活时会删除同源的其他缓存。遵照不修改 V0.1 的要求，本项目不能阻止旧版以后首次安装/重新激活时清除 V0.2 离线缓存。这不会删除 V0.2 的 IndexedDB 记录；重新联网访问 V0.2 可以重新缓存已访问资源。普通打开已激活的 V0.1 不会重复执行激活清理。不要在同一 origin 启动旧版开发模式，其原代码也含全局 SW 注销逻辑。

数据仅保存在当前设备/浏览器。继续使用“记录 → 导出全部记录”保留 JSON 备份；不提供跨设备同步。主屏幕 PWA 和 Safari 的实际共享存储行为以设备验证为准。

## 验收边界

已进行本机浏览器合成数据测试、真实 IndexedDB/SW、离线服务器停止测试、320px/390px 移动宽度与缓存更新测试。真实 iPhone Safari、主屏幕 PWA、安全区域和中文输入法尚需实机确认。部署状态以本次交付报告和 GitHub Actions 实际结果为准。
