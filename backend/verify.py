import io

import numpy as np
from PIL import Image, ImageOps

# mess is painted orange and clean things green, which is easier to tell apart for colour-blind people than red/green
MESS = (217, 105, 42)
GREEN = (34, 197, 94)


def open_photo(data):
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((1024, 1024))
    return img


def find(model, processor, img, prompts):
    import torch

    found = {}
    if not prompts:
        return found
    inputs = processor(images=img, return_tensors="pt").to(model.device)
    sizes = inputs.get("original_sizes").tolist()
    with torch.no_grad():
        # look at the photo once, then ask sam about each thing
        vision = model.get_vision_features(pixel_values=inputs.pixel_values)
        for p in prompts:
            text = processor(text=p, return_tensors="pt").to(model.device)
            out = model(vision_embeds=vision, **text)
            res = processor.post_process_instance_segmentation(
                out, threshold=0.45, mask_threshold=0.5, target_sizes=sizes
            )[0]
            masks = res["masks"]
            mask = np.zeros((img.height, img.width), dtype=bool)
            if len(masks):
                mask = masks.bool().any(dim=0).cpu().numpy()
            found[p] = {
                "mask": mask,
                "count": len(masks),
                "best": round(float(res["scores"].max()), 2) if len(masks) else 0.0,
            }
    return found


def union(found, prompts, img):
    mask = np.zeros((img.height, img.width), dtype=bool)
    for p in prompts:
        if p in found:
            mask |= found[p]["mask"]
    return mask


def things(words):
    if len(words) == 1:
        return words[0]
    return ", ".join(words[:-1]) + " or " + words[-1]


def judge(b, a, look, spot, mode, b_area, a_area):
    b_count = sum(b[p]["count"] for p in look)
    a_count = sum(a[p]["count"] for p in look)
    out = {
        "mode": mode,
        "look_for": look,
        "spot": spot,
        "before": {"count": b_count, "area": round(b_area, 4)},
        "after": {"count": a_count, "area": round(a_area, 4)},
        "found": {p: [b[p]["count"], a[p]["count"]] for p in look},
    }

    def say(verdict, reason):
        out["verdict"] = verdict
        out["reason"] = reason
        return out

    # same place check. only bother if the spot showed up in the before photo
    if spot and b[spot]["count"] and not a[spot]["count"]:
        return say("retry", f"I can't see the {spot} in the after photo. Take it from the same place as the before one.")

    if mode == "show":
        if a_count > b_count or a_area > max(b_area * 1.5, 0.01):
            return say("done", f"Spotted {things(look)} in the after photo. Nice one!")
        return say("retry", f"I couldn't spot {things(look)} in the after photo yet.")

    if b_count == 0:
        return say("retry", f"The before photo didn't show any {things(look)}. Snap it before you start cleaning.")

    cleared = 1 - a_area / b_area if b_area > 0 else (1.0 if a_count == 0 else 0.0)
    out["cleared"] = round(max(0.0, cleared), 2)
    if a_count == 0 or (cleared >= 0.6 and a_count < b_count) or a_count <= b_count // 3:
        return say("done", f"{b_count} → {a_count}. {round(out['cleared'] * 100)}% cleared, looks done!")
    return say("retry", f"Still seeing {a_count} ({things(look)}), there were {b_count}. Almost there!")


def mark(img, mask, color):
    px = np.asarray(img).astype(np.float32)
    px[mask] = px[mask] * 0.4 + np.array(color, np.float32) * 0.6
    buf = io.BytesIO()
    Image.fromarray(px.astype(np.uint8)).save(buf, "JPEG", quality=80)
    return buf.getvalue()


def run(model, processor, before_bytes, after_bytes, check):
    look = [p for p in check.get("look_for", []) if p][:4] or ["mess"]
    spot = (check.get("spot") or "").strip()
    mode = check.get("mode", "clear")
    prompts = look + ([spot] if spot and spot not in look else [])

    before = open_photo(before_bytes)
    after = open_photo(after_bytes)
    b = find(model, processor, before, prompts)
    a = find(model, processor, after, prompts)

    b_mask = union(b, look, before)
    a_mask = union(a, look, after)
    result = judge(b, a, look, spot, mode, float(b_mask.mean()), float(a_mask.mean()))

    color = GREEN if mode == "show" else MESS
    result["before_marked"] = mark(before, b_mask, color)
    result["after_marked"] = mark(after, a_mask, color)
    return result
