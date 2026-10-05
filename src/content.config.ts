// Lists shown on the page. Each lives in a JSON file under src/data/; add an entry there to add a card.
import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

const order = z.number().int();

const projects = defineCollection({
  loader: file("src/data/projects.json"),
  schema: z.object({
    order,
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    url: z.string(),
  }),
});

const skills = defineCollection({
  loader: file("src/data/skills.json"),
  schema: z.object({ order, name: z.string() }),
});

// Awards and certifications share a shape.
const credential = z.object({ order, title: z.string(), issuer: z.string(), year: z.string() });
const awards = defineCollection({ loader: file("src/data/awards.json"), schema: credential });
const certifications = defineCollection({ loader: file("src/data/certifications.json"), schema: credential });

const testimonials = defineCollection({
  loader: file("src/data/testimonials.json"),
  schema: z.object({ order, quote: z.string(), name: z.string(), company: z.string() }),
});

export const collections = { projects, skills, awards, certifications, testimonials };
