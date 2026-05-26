"""Remove baked checkerboard / white background from fire-3d.png."""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "assets" / "overheat" / "fire-3d.png"


def is_bg(r: int, g: int, b: int) -> bool:
    if r > 248 and g > 248 and b > 248:
        return True
    if r > 155 and g > 155 and b > 155 and max(r, g, b) - min(r, g, b) < 18:
        return True
    return False


def is_flame(r: int, g: int, b: int) -> bool:
    if r < 120:
        return False
    return r - b > 35 and g > 100


def main() -> None:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(*px[x, y][:3]) and not visited[y][x]:
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(*px[x, y][:3]) and not visited[y][x]:
                visited[y][x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                nr, ng, nb, _ = px[nx, ny]
                if is_bg(nr, ng, nb) and not is_flame(nr, ng, nb):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    img.save(path)
    print(f"Wrote transparent background: {path} ({w}x{h})")


if __name__ == "__main__":
    main()
