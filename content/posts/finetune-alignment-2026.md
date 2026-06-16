---
title: "Finetuning & Alignment (2026 Edition)"
date: 2026-06-16
description: "The latest trends in parameter-efficient fine-tuning, action token grounding, and memory-efficient alignment."
tags: ["fine-tuning", "alignment", "genai", "mllm"]
---

Continued from [last week’s posting on computer vision foundation models.](https://byungsooo.github.io/posts/cv_foundation_models_2026/).

# Finetuning & Alignment

While backbone models are highly robust across multiple domains, the fine-tuning process bridges the gap between a backbone's general capabilities and an application's specific operational requirements. Once a suitable backbone model is selected—such as Qwen-VL for multimodal understanding or the DiT family for pixel-level generation—the next architectural decision is choosing the right fine-tuning methodology.

## Finetuning Full-Layers vs. Targeted-Layers vs. LoRA

Fine-tuning can be applied across full layers, restricted to targeted projection layers, or isolated via low-rank adapters (PEFT). While full-layer fine-tuning comprehensively handles deep domain distribution shifts, it introduces extreme VRAM overhead, necessitating complex distributed training mechanics like FSDP or ZeRO-3. 

Consequently, if the underlying domain distribution remains constant and only the downstream target task changes, parameter-efficient fine-tuning (PEFT) via LoRA (or its variants) is often optimal. 

$$h = W_0 x + \Delta W x = W_0 x + \frac{\alpha}{r} (BA)x$$

When implementing LoRA, specific structural initialization details are critical. For instance, initializing matrix $A$ with a random Gaussian distribution and matrix $B$ to zero is essential to break mathematical symmetry while avoiding zero-gradient initialization traps during step zero.

## Finetuning with Action Tokens

Providing new capabilities is more interesting, just like the latest trend in robotics of fine-tuning VLMs with additional action tokens.

In broader computer vision applications, "action" translates to injecting explicit geometric or task-oriented coordinate tokens. Rather than treating vision as a passive perceptual task, this approach provides spatial grounding, enabling models to actively interact with, reason about, and manipulate spatial layouts or human interactions.

## Alignment

Aligning models based on human feedback or structural constraints remains a crucial phase for production readiness. For instance, [SAM3D](https://ai.meta.com/research/sam3d/) uses human 3D artist inputs to align its structural outputs, effectively bridging the fidelity gap between synthetic training data and real-world edge cases. 

When it comes to preference alignment, the industry paradigm has rapidly shifted from traditional PPO to memory-efficient, rule-based alternatives. Standard PPO is notorious for its infrastructural overhead; because its absolute advantage estimation requires a dynamic baseline, engineers are forced to host both the Policy (Actor) network and a separate Value (Critic) network in memory simultaneously. Scaling two asymmetric, multi-billion-parameter models across distributed clusters introduces severe memory bottlenecks and N-dimensional parallelism engineering challenges.

To bypass this infrastructure bottleneck, GRPO completely eliminates the Critic network. Instead, it samples a group of outputs ($o_1, o_2, \dots, o_G$) from the old policy ($\pi_{\theta_{old}}$) for a single prompt and computes a relative, normalized advantage directly within that peer group:

$$\mathcal{L}_{\text{GRPO}}(\theta) = \frac{1}{G} \sum_{i=1}^{G} \left[ \min \left( \frac{\pi_\theta(o_i|q)}{\pi_{\theta_{old}}(o_i|q)} \tilde{A}_i, \text{clip}\left(\frac{\pi_\theta(o_i|q)}{\pi_{\theta_{old}}(o_i|q)}, 1-\epsilon, 1+\epsilon\right) \tilde{A}_i \right) - \beta D_{KL}(\pi_\theta \| \pi_{ref}) \right]$$

By utilizing a standardized relative reward—where the advantage is computed purely as $\tilde{A}_i = \frac{R_i - \text{mean}(R)}{\text{std}(R)}$ across the sampled outputs—GRPO dramatically cuts down GPU memory consumption, freeing up hardware capacity to scale batch sizes or utilize larger base backbones instead.

Slightly distinct from these heavy RL-based alignment methods, latent-nudging strategies, such as ControlNet or IC-Light, sometimes offer pragmatic alternatives. By augmenting training data and building a parallel, trainable copy of the backbone's structural paths, they seamlessly encode explicit conditional constraints like light direction or structural boundaries without modifying the base generation capabilities.
