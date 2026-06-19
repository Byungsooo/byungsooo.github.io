---
title: "Infra & Inference (2026 Edition)"
date: 2099-12-31
description: "The latest trends in parameter-efficient fine-tuning, action token grounding, and memory-efficient alignment."
tags: ["fine-tuning", "alignment", "genai", "mllm"]
draft: true
---

Continued from the other postings -- [computer vision foundation models (2026)](https://byungsooo.github.io/posts/cv_foundation_models_2026/) and [finetuning and alignment (2026)](https://byungsooo.github.io/posts/finetune-alignment-2026).

---

# Memory Bottleneck

For MLLMs, memory pressure is driven primarily by the integration of high-resolution spatial data and extended video sequences. The input sequence length ($L$) has become the critical axis pushing the limits of existing hardware, particularly during the materialization of the intermediate $Q K^T$ attention matrices.

## Efficient Memory Management and GPU Orchestration

To train and scale these systems without triggering immediate Out-of-Memory (OOM), modern orchestration relies on tightly decoupled multi-dimensional parallelism matrices executed through highly optimized core engines. For instance, NVIDIA's Megatron-Core framework natively handles combinations of Tensor (TP), Pipeline (PP), Data (DP), Expert (EP), and Context Parallelism (CP), seamlessly scaling across massive clusters ($\text{TP} \times \text{PP} \times \text{DP} \times \text{EP} \times \text{CP}$ total GPUs). Alternative paradigms like PyTorch FSDP2 and DeepSpeed similarly distribute states, though each introduces distinct trade-offs between memory footprint, computational overhead, and engineering flexibility.

## Inference Memory Management

Serving long-context MLLMs at scale introduces a non-trivial pivot from training infrastructure, shifting focus from static batch slicing to dynamic runtime memory orchestration.

### 1. Virtualized Allocations via vLLM
The de facto industry standard for managing dynamic sequence lengths is **vLLM**, powered by **PagedAttention**. By mirroring the virtual memory page tables of traditional operating systems, vLLM shards the Key-Value (KV) cache into non-contiguous physical memory blocks. This completely eliminates internal and external memory fragmentation, allowing serving systems to scale concurrent requests near the physical VRAM ceiling.

### 2. Resolving Prefill/Decode Asymmetry
In multi-modal workloads, inference faces a severe operational split:
- **The Prefill Phase:** Processing massive initial visual cues (e.g., thousands of spatial patches) is highly parallel and **Compute-bound**.
- **The Decode Phase:** Generating reasoning tokens sequentially is **Memory-bandwidth bound**, as the model must cycle the entire weight and cache state from HBM for every isolated token.

To decouple these phases and protect existing token generation pipelines from being stalled by massive multi-modal prompts, modern systems leverage **Chunked Prefills**. This technique chops incoming sequence inputs into uniform blocks and schedules them smoothly within active decoding cycles.

### 3. Tree-Structured Caching for System 2 Scaling
With frontier architectures scaling test-time compute (Inference-Time Scaling via extended hidden Chain-of-Thought paths), reasoning agents frequently branch out via multi-path search trees or parallel verification rollouts. 

Standard linear caching collapses under this weight. Production inference engines now deploy **Tree-Structured Radix Caching**. When multiple reasoning paths branch off from the same 50k-token video prefix, the engine locks a single, read-only root page block in memory and forks the allocation *only* at the divergent reasoning nodes—saving gigabytes of HBM across parallel threads.
