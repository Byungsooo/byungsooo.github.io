---
title: "Foundational Backbone Models (2026 Edition)"
date: 2026-06-08
description: "A product-oriented guide to select the right foundational backbones."
tags: ["foundation-model", "computer-vision", "genai", "mllm"]
---

I recently [quit my last job](https://www.linkedin.com/posts/byungsoo-kim-b0247458_today-marks-my-last-day-at-zoox-it-has-been-share-7468811770841735168-M1pZ/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAAwryDIBbZExPzpaHqTLrfsbzR76Hi0yFCw) and will be joining a new company in two weeks. Two weeks of vacation is definitely a good time to re-learn something. I hope sharing my notes help someone who is onboarding or re-onboarding into Computer Vision (MLLM, GenAI) in 2026.


# Backbone Foundation Models

While performance in benchmarks (MMMU, DocVQA, OCRBench, …) definitely matters, application-specific requirements still matter as an important criterion when selecting the backbone models.

For example, for image understanding or for OCRs, the Qwen3-VL model is strong in handling high-resolution images (by adopting the DeepStack token structure well with less computational burden) and multi-ratio images (by curating training data with multi-ratios, adopting 2D/3D RoPE, and dynamically scaling absolute embeddings via CoMP). It could be a better fit if the applications are related to document processing or structured OCR in many different formats. DeepSeek or Llama could be a better alternative if the application focuses more on the reasoning side, thanks to their constant token sizes and MLA-compressed KV feature caching.

Unlike image understanding models, generative models must preserve fine-grained, high-frequency pixel details that often originate from previous multimodal frames or various conditioning constraints. Qwen, DeepSeek, and Llama are typically not the right choices here, as they aggressively abstract tokens in a Perceiver-style manner, and their loss functions are not defined to capture high-frequency visual information. Instead, Diffusion Transformers (DiTs) (e.g. Stable Diffusion or Flux) are the appropriate choices, as they bypass semantic token compression and define their losses directly within continuous reconstruction spaces.

World Models represent the world in latent space and generate contents based on the latent world and the conditioning action. I think the boundary between generation and world modeling blurs if we redefine image editing or viewpoint adjustments as explicit "agent actions". Maybe one practical downside as of today is massive computational overhead and challenges on defining action-conditioning compared to cost-effective DiT and LLM backbones.

This post is getting a bit long. I’ll dive into Finetuning & Alignment, and Infra & Inference next week. 
