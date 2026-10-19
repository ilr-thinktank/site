import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase URL slug');
const media = z.string().refine(value => !value || value.startsWith('/media/') || value.startsWith('/wp-content/uploads/') || /^https:\/\//.test(value), 'Use an uploaded media path or HTTPS URL');
const common = {
  title: z.string().min(1), slug, date: z.coerce.date(),
  description: z.string().default(''), image: media.default(''),
  pdf: media.default(''), draft: z.boolean().default(true),
};
export const collections = {
  articles: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './content/articles' }),
    schema: z.object({ ...common, author: z.string().min(1), authorRole: z.string().default(''), rubrique: z.enum(['Audiences', 'Bancs d’essai', 'Raisons d’État', 'Angles morts']), category: z.enum(['Vidéo', 'Tribune', 'Essai court', 'Podcast', 'Analyse de fond']).default('Essai court') }),
  }),
  events: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './content/events' }),
    schema: z.object({ ...common, location: z.string().default(''), category: z.enum(['Conférence', 'Audience', 'Commission de travail']).default('Conférence'), registrationUrl: z.string().refine(value => !value || /^https:\/\//.test(value), 'Use an HTTPS registration URL').default('') }),
  }),
};
