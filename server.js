/**
 * AI Mostafa Alsaman — Backend Server
 * جميع الحقوق محفوظة © 2026 #ابوالسمان
 *
 * تشغيل:
 *   1. npm install
 *   2. أضف OPENAI_API_KEY في ملف .env
 *   3. node server.js
 *   4. افتح المتصفح على http://localhost:3000
 */

require('dotenv').config();
const express = require('express');
const path    = require('path');
const OpenAI  = require('openai');

const app  = express();
const port = process.env.PORT || 3000;

// ── OpenAI Client ──
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Middleware ──
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-Memory Store ──
let conversations = [];
let nextId = 1;

// ═══════════════════════════════
//  CONVERSATIONS
// ═══════════════════════════════

// GET all conversations
app.get('/api/openai/conversations', (req, res) => {
  res.json(conversations.map(({ id, title, createdAt }) => ({ id, title, createdAt })));
});

// POST create conversation
app.post('/api/openai/conversations', (req, res) => {
  const { title } = req.body;
  const conv = { id: nextId++, title: title || 'محادثة جديدة', messages: [], createdAt: new Date().toISOString() };
  conversations.unshift(conv);
  res.json({ id: conv.id, title: conv.title, createdAt: conv.createdAt });
});

// GET single conversation with messages
app.get('/api/openai/conversations/:id', (req, res) => {
  const conv = conversations.find(c => c.id === parseInt(req.params.id));
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(conv);
});

// DELETE conversation
app.delete('/api/openai/conversations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  conversations = conversations.filter(c => c.id !== id);
  res.json({ ok: true });
});

// ═══════════════════════════════
//  CHAT — Streaming
// ═══════════════════════════════

app.post('/api/openai/conversations/:id/messages', async (req, res) => {
  const conv = conversations.find(c => c.id === parseInt(req.params.id));
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Empty message' });

  conv.messages.push({ id: Date.now(), role: 'user', content });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'أنت مساعد ذكاء اصطناعي متقدم يتحدث العربية والإنجليزية بطلاقة.' },
        ...conv.messages.map(m => ({ role: m.role, content: m.content }))
      ],
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullContent += token;
        res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
      }
    }

    conv.messages.push({ id: Date.now() + 1, role: 'assistant', content: fullContent });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ content: '❌ خطأ في الاتصال بـ OpenAI.' })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

// ═══════════════════════════════
//  IMAGE GENERATOR
// ═══════════════════════════════

app.post('/api/openai/generate-image', async (req, res) => {
  const { prompt, size } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: size || '1024x1024',
      n: 1,
    });
    res.json({ url: response.data[0].url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ═══════════════════════════════
//  ARTICLE WRITER — Streaming
// ═══════════════════════════════

app.post('/api/openai/generate-article', async (req, res) => {
  const { topic, type, language } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });

  const typeMap = {
    article: 'مقال شامل ومفصل',
    social_post: 'منشور سوشيال ميديا جذاب وقصير',
    product_description: 'وصف منتج احترافي ومقنع',
  };
  const typeLabel = typeMap[type] || 'مقال';
  const lang      = language || 'Arabic';

  const systemPrompt = lang === 'Arabic'
    ? `أنت كاتب محتوى محترف. اكتب ${typeLabel} باللغة العربية الفصحى بأسلوب متميز.`
    : `You are a professional content writer. Write a ${type || 'detailed article'} in English with a distinctive style.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `الموضوع / Topic: ${topic}` },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ content: '❌ فشل توليد المحتوى.' })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

// ── Catch-all → serve index.html ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
