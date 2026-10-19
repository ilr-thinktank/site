import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase URL slug');
const media = z.string().refine(value => !value || value.startsWith('/media/') || value.startsWith('/wp-content/uploads/') || /^https:\/\//.test(value), 'Use an uploaded media path or HTTPS URL');
// YAML 1.1 parsers read an unquoted 02:15 as the number 135 (base 60), i.e. seconds: turn it back into text.
const two = n => String(n).padStart(2, '0');
const timestamp = z.preprocess(
  value => typeof value === 'number' ? (value >= 3600 ? `${Math.floor(value / 3600)}:${two(Math.floor(value / 60) % 60)}:${two(value % 60)}` : `${two(Math.floor(value / 60))}:${two(value % 60)}`) : value,
  z.string().regex(/^\d{1,2}:\d{2}(?::\d{2})?$/, 'Use mm:ss or h:mm:ss'),
);
const common = {
  title: z.string().min(1), slug, date: z.coerce.date(),
  description: z.string().default(''), image: media.default(''),
  pdf: media.default(''), draft: z.boolean().default(true),
};
export const collections = {
  articles: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './content/articles' }),
    schema: z.object({ ...common, author: z.string().min(1), authorRole: z.string().default(''), rubrique: z.enum(['Audiences', 'Bancs d’essai', 'Raisons d’État', 'Angles morts']), themes: z.array(z.string().min(1)).default([]), media: media.default(''), transcript: z.array(z.object({ time: timestamp, heading: z.string().default(''), text: z.string().min(1) })).default([]), category: z.enum(['Vidéo', 'Tribune', 'Essai court', 'Podcast', 'Analyse de fond']).default('Essai court') }),
  }),
  events: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './content/events' }),
    schema: z.object({ ...common, location: z.string().default(''), category: z.enum(['Conférence', 'Audience', 'Commission de travail']).default('Conférence'), registrationUrl: z.string().refine(value => !value || /^https:\/\//.test(value), 'Use an HTTPS registration URL').default('') }),
  }),
};
