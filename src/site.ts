export const site = {
  name: '余安的数字花园',
  author: '余安',
  github: 'https://github.com/Study-ym',
  repo: 'https://github.com/Study-ym/Study-ym.github.io',
  description: '记录遇见的事、还在生长的想法，以及亲手做的小工具。',
};

export const stages = {
  seed: { label: '幼苗', description: '刚刚记下，留待继续' },
  growing: { label: '生长中', description: '不断补充，逐渐清晰' },
  evergreen: { label: '常青', description: '反复打磨，值得回看' },
} as const;

export const ideaStates = { idea: '待探索', doing: '进行中', done: '已完成' } as const;
export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date).replaceAll('/', '.');
}
