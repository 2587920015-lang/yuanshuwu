// 书籍元数据 - 4本书
window.__ALL_BOOKS__ = [
  {
    _id: "1",
    title: "二哈和他的白猫师尊",
    author: "肉包不吃肉",
    cover: "",
    description: "墨燃觉得自己拜楚晚宁为师就是个错误。他的师尊实在太像猫，而他则像一只摇头摆尾的傻狗。狗和猫是有生殖隔离的，傻狗原本并不想向那只猫伸出他毛茸茸的爪子。可是死过去又活过来，活了两辈子，他最后叼回窝里的，都是那个最初他根本瞧不上眼的，雪白的猫咪师尊。修真界帝君墨微雨，欺师灭祖，十恶不赦，自戕身亡后重生到刚拜入师门的那一年……",
    category: "仙侠",
    price: 0.99,
    chapterCount: 321,
    totalWords: 1568470,
    salesCount: 0,
    source: "builtin"
  },
  {
    _id: "2",
    title: "快穿之打脸狂魔",
    author: "风流书呆",
    cover: "",
    description: "顶尖黑客被主神选中当了几百近千世的反派，每一世都不得不狂奔在作死的大道上，落得个悲惨收场。终于摆脱了反派系统的控制，他决定复仇、虐渣、改变命运，就算骨子里烂透了，表面上也要占据道德的制高点。",
    category: "言情",
    price: 0.99,
    chapterCount: 178,
    totalWords: 1281751,
    salesCount: 0,
    source: "builtin"
  },
  {
    _id: "3",
    title: "有姝",
    author: "风流书呆",
    cover: "",
    description: "从前有一位美人，他不停倒霉，所以急需抱一根金大腿……感谢好基友羲和清零制作的封面。",
    category: "言情",
    price: 0.99,
    chapterCount: 149,
    totalWords: 822274,
    salesCount: 0,
    source: "builtin"
  },
  {
    _id: "4",
    title: "镇魂",
    author: "priest",
    cover: "",
    description: "如题，都市灵异故事。温柔内敛攻VS暴躁精分受。没人知道在城市中隐藏着"特别调查处"这个机构，此机构专门调查活人找不到头绪的案件，处长赵云澜也不是简单的人，继承了镇魂令的他向来秉公执法……",
    category: "灵异",
    price: 0.99,
    chapterCount: 25,
    totalWords: 498161,
    salesCount: 0,
    source: "builtin"
  }
];

// 兼容旧代码
window.__BOOK_DATA__ = window.__ALL_BOOKS__[0];
console.log('书籍数据已加载: ' + window.__ALL_BOOKS__.length + '本书');
