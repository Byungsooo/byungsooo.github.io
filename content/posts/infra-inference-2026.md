---
title: "Infra & Inference (2026 Edition)"
date: 2026-06-19
description: "The latest trends in parameter-efficient fine-tuning, action token grounding, and memory-efficient alignment."
tags: ["fine-tuning", "alignment", "genai", "mllm"]
draft: true
---

Continued from the other postings -- [computer vision foundation models (2026)](https://byungsooo.github.io/posts/cv_foundation_models_2026/) and [finetuning and alignment (2026)](https://byungsooo.github.io/posts/finetune-alignment-2026).

---

# Memory Bottleneck

For MLLMs, memory pressure is driven primarily by the integration of high-resolution spatial data and extended video sequences. The input sequence length ($L$) has become the critical axis pushing the limits of existing hardware, particularly during the materialization of the intermediate $Q K^T$ attention matrices.

## Efficient Memory Management and GPU Orchestration

To train and scale these systems without triggering immediate Out-of-Memory (OOM) errors, modern orchestration relies on tightly decoupled multi-dimensional parallelism matrices executed through highly optimized core engines. For instance, NVIDIA's [Megatron-Core framework](https://github.com/NVIDIA/Megatron-LM) natively handles combinations of Tensor (TP), Pipeline (PP), Data (DP), Expert (EP), and Context Parallelism (CP), seamlessly scaling across massive clusters ($\text{TP} \times \text{PP} \times \text{DP} \times \text{EP} \times \text{CP}$ total GPUs). Alternative paradigms like PyTorch [FSDP2](https://pytorch.org/docs/stable/fsdp.html) and [DeepSpeed](https://github.com/microsoft/DeepSpeed) similarly distribute states, though each introduces distinct trade-offs between memory footprint, computational overhead, and engineering flexibility.

## Attention Optimization

To mitigate the quadratic memory increase ($O(L^2)$) with respect to the context length, FlashAttention introduced a clever hardware-level optimization by loading query, key, and value blocks directly into SRAM and utilizing an online softmax mechanism, successfully dropping the physical High Bandwidth Memory (HBM) footprint of the intermediate matrix to $O(L)$. To scale beyond a single GPU's memory limit, Context Parallelism techniques like Ring Attention can be stacked on top; it shards the sequence across a cluster of devices, executing local blockwise attention chunks with FlashAttention while concurrently passing intermediate $K$ and $V$ results through a ring topology to perfectly mask communication latency behind active compute.

## Inference Memory Management

When serving models to customers, when tens of thousands of images flow into the system, especially when traffic spikes happen, traditional messaging pipelines (e.g., Kafka) need to either drop or queue the requests. While the fundamental issue still remains true and the only ultimate solution might be the horizontal scaling of GPU clusters, there are architectural techniques to maximize the efficiency of GPU utilization.

Especially, [vLLM](https://github.com/vllm-project/vllm) has mechanisms of PagedAttention, GPU-CPU memory swap, or preemptive recomputation to significantly improve the utilization of GPU memory and flexibility with increased size of memories coming from long context lengths. By treating the KV cache as dynamically allocatable OS-like memory pages, vLLM eliminates physical VRAM fragmentation on HBM and orchestrates scheduling policies on how to fill or eject the data. This is a lossless infrastructure layer that drastically increases concurrent token throughput without losing precision.

# Remaining Bottlenecks: Dynamic Memory Management

While innovations like vLLM's PagedAttention and 5D parallelism have mitigated static context limits, modern MLLM infrastructures handle highly variable inputs that trigger severe hardware-level memory dilemmas. Because the volume of visual tokens fluctuates based on dynamic image resolutions and video lengths, runtime schedulers cannot accurately predict or pre-allocate physical VRAM pages before the vision encoder runs. This unpredictability compounds in multi-turn or RAG environments, where migrating gigabytes of KV cache across distributed GPU nodes via NVLink or InfiniBand introduces networking overheads that often run slower than simply recomputing from scratch. Even disaggregating compute-heavy prefill phases and memory-bandwidth-bound decode phases into separate GPU clusters remains bottlenecked by the complexity of streaming split $K, V$ tensor blocks in real time without creating massive pipeline bubbles.
