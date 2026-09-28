import { getCollection } from 'astro:content';

export async function publicNotes() {
  return (await getCollection('notes', ({ data }) => !data.draft))
    .sort((a, b) => (b.data.updated ?? b.data.date).getTime() - (a.data.updated ?? a.data.date).getTime() || Number(a.data.example) - Number(b.data.example));
}
export async function publicIdeas() {
  return (await getCollection('ideas', ({ data }) => !data.draft))
    .sort((a, b) => (b.data.updated ?? b.data.date).getTime() - (a.data.updated ?? a.data.date).getTime());
}
