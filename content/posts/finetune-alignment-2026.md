---
title: "Finetuning & Alignment (2026 Edition)"
date: 2026-06-16
description: "The latest trend on fine-tuning and alignment."
tags: ["fine-tuning", "alignment", "genai", "mllm"]
draft: true
---

Continued from [the last week’s posting on compouter vision foundation models.](https://byungsooo.github.io/posts/cv_foundation_models_2026/).

# Finetuning & Alignment
    
While backbone models are strong across multiple domains, the finetuning process bridges the gap between the general capabilities of a backbone and the specific requirements of an application. Once a suitable backbone model is selected, such as Qwen-VL for image understanding or the DiT family for pixel-level generation, the next decision needed is choosing the right finetuning methodology.
    
Finetuning is often done to provide more capacity to the model, either for specialization on a certain subdomain or to provide new capabilities. For sub-domain specialization, Parameter-Efficient Fine-Tuning (PEFT) with LoRA (or DoRA) has already been popular for a while.

- [ ] TODO: Equations and simple 1~2 sentences to compare DoRA against LoRA.

---

Providing new capabilities is more interesting, just like the latest trend in robotics of finetuning VLMs with additional action tokens. In Computer Vision, it seems that "action" translates to injecting explicit geometric or task-oriented tokens. Rather than treating vision as a passive task, this alignment enables models to actively interact with and manipulate spatial layouts and human interactions.
    
    Alignment based on some form of human input is also popular and easily found in the latest papers. For example, SAM3D (CVPR 2026 Best Paper) uses human 3D artist input to align their model, effectively filling the capacity gap between synthetic data and real-world data. Slightly off from RL-based alignment methods, but methods to nudge model behaviors—such as ControlNet or IC-Light—by augmenting data and training a parallel path of the model to encode style or light conditions seem to be neat and practically strong tricks.
