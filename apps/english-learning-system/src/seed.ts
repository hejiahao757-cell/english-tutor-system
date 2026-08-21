import type { ContentItem } from './domain'

export const contentSeed: ContentItem[] = [
  {
    id: 'u1-u7-daily',
    title: 'U1–U7 综合训练：七选五三篇＋完形＋D篇＋语法填空两篇',
    kind: 'exam', subtype: '综合训练', units: 'U1–U7',
    sourceFile: '初高中衔接训练_U1-U7_七选五三篇加完形D篇语法填空两篇_全功能动态备课密码版.html',
    description: '当前校正版，含短横线题面、折叠解析与黑白打印版。', published: true, updatedAt: '2026-08-19',
  },
  {
    id: 'u1-u5-seven-five-demo',
    title: '七选五示范一篇＋正式训练四篇',
    kind: 'exam', subtype: '七选五', units: 'U1–U5',
    sourceFile: '初高中衔接训练_U1-U5_七选五示范一篇加训练四篇_全功能动态备课密码版.html',
    description: '先独立作答，再按方法展开教学讲解。', published: true, updatedAt: '2026-08-05',
  },
  {
    id: 'u1-u5-recurrence',
    title: '七选五两篇＋完形两篇：生词复现系统',
    kind: 'exam', subtype: '综合训练', units: 'U1–U5',
    sourceFile: '初高中衔接训练_U1-U5_七选五两篇加完形两篇_生词复现系统版 (1).html',
    description: '生词复现与题目训练联动。', published: true, updatedAt: '2026-08-05',
  },
  {
    id: 'u1-u5-cloze-3',
    title: '三篇完形：生词本互动备课版',
    kind: 'exam', subtype: '完形填空', units: 'U1–U5',
    sourceFile: '初高中衔接训练_U1-U5_三篇完形_生词本互动备课版.html',
    description: '完形训练与生词卡整理。', published: true, updatedAt: '2026-08-05',
  },
  {
    id: 'u1-u5-d-cloze',
    title: 'D篇＋完形：深度优化互动备课版',
    kind: 'exam', subtype: '阅读与完形', units: 'U1–U5',
    sourceFile: '初高中衔接训练_U1-U5_D篇加完形_深度优化互动备课版(1).html',
    description: 'D篇阅读与完形组合训练。', published: true, updatedAt: '2026-08-05',
  },
  {
    id: 'u1-u5-d-3',
    title: 'D篇三连：互动词块版',
    kind: 'exam', subtype: '阅读理解 D篇', units: 'U1–U5',
    sourceFile: '初高中衔接阅读训练_U1-U5_D篇三连_互动词块版.html',
    description: '三篇 D 篇阅读与词块互动。', published: true, updatedAt: '2026-07-31',
  },
  {
    id: 'u1-reading-set',
    title: 'U1 阅读训练一套题：互动解析版',
    kind: 'exam', subtype: '阅读理解', units: 'U1',
    sourceFile: '初高中衔接阅读训练_U1_一套题_互动解析版.html',
    description: 'U1 单元阅读完整训练。', published: true, updatedAt: '2026-07-31',
  },
  {
    id: 'abc-method',
    title: 'ABC 篇阅读技巧体系方法卡',
    kind: 'knowledge', subtype: '阅读方法', units: 'U1–U5',
    sourceFile: '初高中衔接阅读技巧体系_ABC篇方法卡(1).html',
    description: '学生可直接查看的阅读方法知识库。', published: true, updatedAt: '2026-07-31',
  },
  {
    id: 'u1-u4-words-25',
    title: 'U1–U4 随机 25 词简易题单',
    kind: 'dictation', subtype: '默听写', units: 'U1–U4',
    sourceFile: 'U1-U4_随机25词_简易题单 (1).html',
    description: '支持中译英、英译中、听音拼写与随机抽词的内容来源。', published: true, updatedAt: '2026-08-05',
  },
]

export const practiceWords = [
  ['achieve', '实现；达到'], ['active', '积极的；活跃的'], ['advice', '建议'],
  ['attention', '注意力'], ['avoid', '避免'], ['careful', '仔细的'],
  ['community', '社区'], ['complete', '完成；完整的'], ['experience', '经历；经验'],
  ['improve', '提高；改善'], ['memory', '记忆'], ['prepare', '准备'],
]
