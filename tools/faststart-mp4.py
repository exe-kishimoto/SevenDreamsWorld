#!/usr/bin/env python3
"""mp4 を faststart 化する（moov アトムを先頭へ移動）。

ブラウザで mp4 をプログレッシブ再生するには moov が mdat より前に必要。
動画モニター用の動画を差し替えたら、これを実行してください。

  python tools/faststart-mp4.py asset/monitor/video/video-1.mp4

- 元ファイルは <name>.original.mp4 にバックアップします（既にあれば作りません）。
- 既に faststart 済みなら何もしません。
- ffmpeg 不要（H.264/H.265 どちらの mp4 でも atom 並べ替えのみ）。
"""
import struct, sys, shutil, os


def top_atoms(d):
    atoms = []; i = 0; m = len(d)
    while i + 8 <= m:
        size = struct.unpack('>I', d[i:i + 4])[0]; typ = d[i + 4:i + 8]; hdr = 8
        if size == 1:
            size = struct.unpack('>Q', d[i + 8:i + 16])[0]; hdr = 16
        elif size == 0:
            size = m - i
        atoms.append((typ, i, size, hdr))
        if size <= 0:
            break
        i += size
    return atoms


CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'edts', b'udta', b'mvex'}


def patch(b, start, end, delta):
    i = start
    while i + 8 <= end:
        size = struct.unpack('>I', b[i:i + 4])[0]; typ = bytes(b[i + 4:i + 8]); hdr = 8
        if size == 1:
            size = struct.unpack('>Q', b[i + 8:i + 16])[0]; hdr = 16
        elif size == 0:
            size = end - i
        payload = i + hdr
        if typ in CONTAINERS:
            patch(b, payload, i + size, delta)
        elif typ == b'stco':
            cnt = struct.unpack('>I', b[payload + 4:payload + 8])[0]; p = payload + 8
            for _ in range(cnt):
                v = struct.unpack('>I', b[p:p + 4])[0]
                struct.pack_into('>I', b, p, (v + delta) & 0xFFFFFFFF); p += 4
        elif typ == b'co64':
            cnt = struct.unpack('>I', b[payload + 4:payload + 8])[0]; p = payload + 8
            for _ in range(cnt):
                v = struct.unpack('>Q', b[p:p + 8])[0]
                struct.pack_into('>Q', b, p, v + delta); p += 8
        if size <= 0:
            break
        i += size


def main(path):
    data = open(path, 'rb').read()
    atoms = top_atoms(data)
    moov = next((a for a in atoms if a[0] == b'moov'), None)
    mdat = next((a for a in atoms if a[0] == b'mdat'), None)
    if not moov or not mdat:
        print('moov/mdat が見つかりません:', path); return 1
    if moov[1] < mdat[1]:
        print('既に faststart です:', path); return 0

    moov_bytes = bytearray(data[moov[1]:moov[1] + moov[2]])
    patch(moov_bytes, 0, len(moov_bytes), len(moov_bytes))

    out = bytearray()
    for typ, pos, size, hdr in atoms:
        if typ == b'moov':
            continue
        if typ == b'mdat':
            out += moov_bytes
        out += data[pos:pos + size]

    bak = os.path.splitext(path)[0] + '.original.mp4'
    if not os.path.exists(bak):
        shutil.copyfile(path, bak)
    open(path, 'wb').write(out)
    print('faststart 化しました:', path, '(backup:', bak, ')')
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('usage: python tools/faststart-mp4.py <file.mp4>'); sys.exit(2)
    sys.exit(main(sys.argv[1]))
