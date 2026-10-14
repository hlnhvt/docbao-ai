/**
 * English sources about AI (checked 2026-10-13). kind: rss (RSS or Atom), hf (Hugging Face daily
 * papers API), hn (Hacker News through Algolia). aiOnly: a general feed, kept to AI items.
 */
export const SOURCES = [
  { id: 'hf', name: 'Hugging Face Papers', group: 'research', kind: 'hf', url: 'https://huggingface.co/api/daily_papers?limit=50' },
  { id: 'natmi', name: 'Nature Machine Intelligence', group: 'research', kind: 'rss', url: 'https://www.nature.com/natmachintell.rss' },
  { id: 'arxiv-ai', name: 'arXiv cs.AI', group: 'research', kind: 'rss', url: 'https://rss.arxiv.org/rss/cs.AI', arxiv: true },
  { id: 'arxiv-cl', name: 'arXiv cs.CL', group: 'research', kind: 'rss', url: 'https://rss.arxiv.org/rss/cs.CL', arxiv: true },
  { id: 'arxiv-lg', name: 'arXiv cs.LG', group: 'research', kind: 'rss', url: 'https://rss.arxiv.org/rss/cs.LG', arxiv: true },
  { id: 'openai', name: 'OpenAI', group: 'lab', kind: 'rss', url: 'https://openai.com/news/rss.xml' },
  { id: 'deepmind', name: 'Google DeepMind', group: 'lab', kind: 'rss', url: 'https://deepmind.google/blog/rss.xml' },
  { id: 'googleai', name: 'Google AI', group: 'lab', kind: 'rss', url: 'https://blog.google/technology/ai/rss/' },
  { id: 'hfblog', name: 'Hugging Face Blog', group: 'lab', kind: 'rss', url: 'https://huggingface.co/blog/feed.xml' },
  { id: 'msr', name: 'Microsoft Research', group: 'lab', kind: 'rss', url: 'https://www.microsoft.com/en-us/research/feed/' },
  { id: 'bair', name: 'BAIR Berkeley', group: 'lab', kind: 'rss', url: 'https://bair.berkeley.edu/blog/feed.xml' },
  { id: 'nvidia', name: 'NVIDIA Blog', group: 'lab', kind: 'rss', url: 'https://blogs.nvidia.com/feed/', aiOnly: true },
  { id: 'importai', name: 'Import AI', group: 'newsletter', kind: 'rss', url: 'https://importai.substack.com/feed' },
  { id: 'raschka', name: 'Ahead of AI', group: 'newsletter', kind: 'rss', url: 'https://magazine.sebastianraschka.com/feed' },
  { id: 'interconnects', name: 'Interconnects', group: 'newsletter', kind: 'rss', url: 'https://www.interconnects.ai/feed' },
  { id: 'latent', name: 'Latent Space', group: 'newsletter', kind: 'rss', url: 'https://www.latent.space/feed' },
  { id: 'simonw', name: 'Simon Willison', group: 'newsletter', kind: 'rss', url: 'https://simonwillison.net/atom/everything/', aiOnly: true },
  { id: 'mittr', name: 'MIT Technology Review', group: 'press', kind: 'rss', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { id: 'verge', name: 'The Verge', group: 'press', kind: 'rss', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { id: 'techcrunch', name: 'TechCrunch', group: 'press', kind: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { id: 'ars', name: 'Ars Technica', group: 'press', kind: 'rss', url: 'https://arstechnica.com/ai/feed/' },
  { id: 'wired', name: 'Wired', group: 'press', kind: 'rss', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
  { id: 'r-ml', name: 'r/MachineLearning', group: 'community', kind: 'rss', url: 'https://www.reddit.com/r/MachineLearning/top/.rss?t=day&limit=50', reddit: true },
  { id: 'r-llama', name: 'r/LocalLLaMA', group: 'community', kind: 'rss', url: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day&limit=50', reddit: true },
  { id: 'hn', name: 'Hacker News', group: 'community', kind: 'hn', aiOnly: true },
  { id: 'lobsters', name: 'Lobste.rs', group: 'community', kind: 'rss', url: 'https://lobste.rs/t/ai.rss' },
]

/** Words that mark a story as being about AI, for general feeds. */
export const AI_RE = new RegExp(
  '\\b(ai|a\\.i\\.|llms?|gpt(-\\d)?|chatgpt|claude|gemini|openai|anthropic|deepmind|llama|mistral|qwen|deepseek|grok|' +
    'copilot|agents?|agentic|gpus?|nvidia|cuda|embeddings?|multimodal|generative|pytorch|' +
    'hallucinat\\w*|chatbots?|robotics|superintelligence|agi|transformers?|diffusion|neural|' +
    'fine-?tun\\w*|machine learning|deep learning|language models?|hugging ?face|foundation models?|' +
    'frontier models?|reinforcement learning|self-driving|text-to-\\w+|vision models?|' +
    'reasoning models?|open-?weights?|alignment|rlhf|rag|inference|mcp|vibe coding|coding agents?)\\b',
  'i',
)

/** Reddit posts linking to these count as substantial even when short. */
export const DEEP_HOSTS = [
  'arxiv.org', 'github.com', 'github.io', 'huggingface.co', 'openreview.net', 'aclanthology.org', 'substack.com',
  'openai.com', 'anthropic.com', 'deepmind.google', 'ai.meta.com', 'research.google', 'microsoft.com', 'nvidia.com',
  'semanticscholar.org', 'alphaxiv.org', 'mistral.ai', 'qwenlm.github.io', 'deepseek.com', 'pytorch.org', 'vllm.ai',
]
export const MEDIA_HOSTS = [
  'i.redd.it', 'v.redd.it', 'preview.redd.it', 'imgur.com', 'youtube.com', 'youtu.be', 'x.com', 'twitter.com',
  'tiktok.com', 'instagram.com', 'giphy.com', 'streamable.com',
]
