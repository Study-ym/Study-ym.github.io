export const site = {
  name: '余安的数字花园',
  author: '余安',
  github: 'https://github.com/Study-ym',
  repo: 'https://github.com/Study-ym/Study-ym.github.io',
  description: '余安的个人空间：Ideas、私人空间、工具箱、游戏与更多。',
};

export function gardenModules(cloud: boolean) {
  return [
    { key: 'ideas', url: '/ideas/', label: 'Ideas', icon: 'bulb', description: '捕捉灵感，推进想法。' },
    { key: 'private', url: cloud ? '/private/' : 'https://ymihh.xyz/private/', label: '私人空间', icon: 'lock', description: '只属于你的记录。' },
    { key: 'tools', url: '/tools/', label: '工具箱', icon: 'tools', description: '处理日常的小任务。' },
    { key: 'games', url: '/games/', label: '游戏', icon: 'gamepad', description: '留一点时间，放松一下。' },
    { key: 'other', url: '/other/', label: '其他', icon: 'grid', description: '记录、关于与更多。' },
  ];
}

export const stages = {
  seed: { label: '幼苗', description: '刚刚记下，留待继续' },
  growing: { label: '生长中', description: '不断补充，逐渐清晰' },
  evergreen: { label: '常青', description: '反复打磨，值得回看' },
} as const;

export const ideaStates = { idea: '待探索', doing: '进行中', done: '已完成' } as const;
export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date).replaceAll('/', '.');
}
