import zlib
import struct

def create_tileset_props():
    png_path = 'public/assets/tileset.png'
    with open(png_path, 'rb') as f:
        content = f.read()

    # Parse PNG chunks
    chunks = []
    idx = 8
    while idx < len(content):
        length = struct.unpack('>I', content[idx:idx+4])[0]
        ctype = content[idx+4:idx+8].decode('ascii')
        cdata = content[idx+8:idx+8+length]
        chunks.append((ctype, cdata))
        idx += 8 + length + 4

    ihdr = [c[1] for c in chunks if c[0] == 'IHDR'][0]
    w, h, bitd, colort, compm, filterm, interm = struct.unpack('>IIBBBBB', ihdr)
    idat = b''.join([c[1] for c in chunks if c[0] == 'IDAT'])
    raw = bytearray(zlib.decompress(idat))

    stride = 1 + w * 4

    def get_pixel(x, y):
        offset = y * stride + 1 + x * 4
        return (raw[offset], raw[offset+1], raw[offset+2], raw[offset+3])

    def set_pixel(x, y, r, g, b, a=255):
        if 0 <= x < w and 0 <= y < h:
            offset = y * stride + 1 + x * 4
            raw[offset] = r
            raw[offset+1] = g
            raw[offset+2] = b
            raw[offset+3] = a

    def fill_rect(ox, oy, rx, ry, rw, rh, r, g, b, a=255):
        for py in range(rh):
            for px in range(rw):
                set_pixel(ox + rx + px, oy + ry + py, r, g, b, a)

    def draw_rect_outline(ox, oy, rx, ry, rw, rh, r, g, b, a=255):
        for px in range(rw):
            set_pixel(ox + rx + px, oy + ry, r, g, b, a)
            set_pixel(ox + rx + px, oy + ry + rh - 1, r, g, b, a)
        for py in range(rh):
            set_pixel(ox + rx, oy + ry + py, r, g, b, a)
            set_pixel(ox + rx + rw - 1, oy + ry + py, r, g, b, a)

    # Palette
    DARK = (18, 24, 38)
    STEEL_DARK = (45, 55, 72)
    STEEL_MID = (74, 85, 104)
    STEEL_LIGHT = (140, 155, 175)
    CYAN_BRIGHT = (0, 240, 255)
    CYAN_MID = (0, 180, 210)
    CYAN_DARK = (0, 100, 130)
    ORANGE_BRIGHT = (255, 149, 0)
    ORANGE_MID = (210, 110, 0)
    RED_BRIGHT = (255, 40, 80)
    GREEN_BRIGHT = (0, 255, 120)
    GREEN_MID = (0, 180, 80)
    YELLOW_BRIGHT = (255, 230, 40)
    VIOLET_BRIGHT = (180, 40, 255)
    VIOLET_MID = (120, 20, 180)
    WHITE = (245, 250, 255)

    # 1. prop_workstation_active (128, 0)
    ox, oy = 128, 0
    # Desk Base
    fill_rect(ox, oy, 4, 18, 24, 11, *STEEL_DARK)
    draw_rect_outline(ox, oy, 4, 18, 24, 11, *DARK)
    fill_rect(ox, oy, 6, 20, 20, 3, *STEEL_MID)
    # Keyboard
    fill_rect(ox, oy, 8, 21, 10, 2, *CYAN_BRIGHT)
    set_pixel(ox + 20, oy + 21, *ORANGE_BRIGHT)
    set_pixel(ox + 22, oy + 21, *GREEN_BRIGHT)
    # Monitor Stand & Screen
    fill_rect(ox, oy, 14, 15, 4, 4, *STEEL_MID)
    fill_rect(ox, oy, 6, 4, 20, 12, *DARK)
    draw_rect_outline(ox, oy, 6, 4, 20, 12, *STEEL_LIGHT)
    fill_rect(ox, oy, 8, 6, 16, 8, *CYAN_DARK)
    # Screen lines
    for ly in [7, 9, 11]:
        fill_rect(ox, oy, 9, ly, 10, 1, *CYAN_BRIGHT)
    fill_rect(ox, oy, 20, 7, 3, 5, *CYAN_BRIGHT)

    # 2. prop_locker_closed (160, 0)
    ox, oy = 160, 0
    # Main Locker Body
    fill_rect(ox, oy, 6, 3, 20, 26, *STEEL_MID)
    draw_rect_outline(ox, oy, 6, 3, 20, 26, *DARK)
    # Inner door panel
    draw_rect_outline(ox, oy, 8, 5, 16, 22, *STEEL_DARK)
    # Vent slits top
    for vy in [7, 9, 11]:
        fill_rect(ox, oy, 10, vy, 8, 1, *DARK)
    # Keypad & Handle
    fill_rect(ox, oy, 19, 14, 3, 5, *CYAN_BRIGHT)
    set_pixel(ox + 20, oy + 15, *GREEN_BRIGHT)
    fill_rect(ox, oy, 19, 20, 2, 4, *WHITE)
    # Vent slits bottom
    for vy in [21, 23, 25]:
        fill_rect(ox, oy, 10, vy, 7, 1, *DARK)

    # 3. prop_biocabinet (192, 0)
    ox, oy = 192, 0
    # Cabinet Frame
    fill_rect(ox, oy, 5, 3, 22, 26, *WHITE)
    draw_rect_outline(ox, oy, 5, 3, 22, 26, *DARK)
    fill_rect(ox, oy, 7, 4, 18, 3, *CYAN_MID) # Header
    # Red Cross / Bio emblem
    fill_rect(ox, oy, 14, 5, 4, 2, *RED_BRIGHT)
    fill_rect(ox, oy, 15, 4, 2, 4, *RED_BRIGHT)
    # Glass Chamber
    fill_rect(ox, oy, 7, 8, 18, 19, *DARK)
    draw_rect_outline(ox, oy, 7, 8, 18, 19, *STEEL_LIGHT)
    # Glowing Vials inside
    for vx, col in [(9, GREEN_BRIGHT), (15, CYAN_BRIGHT), (21, ORANGE_BRIGHT)]:
        fill_rect(ox, oy, vx, 12, 3, 11, *col)
        draw_rect_outline(ox, oy, vx, 12, 3, 11, *WHITE)
        set_pixel(ox + vx + 1, oy + 11, *WHITE) # Cap

    # 4. prop_safe_locked (224, 0)
    ox, oy = 224, 0
    # Heavy Armored Body
    fill_rect(ox, oy, 5, 6, 22, 21, *STEEL_DARK)
    draw_rect_outline(ox, oy, 5, 6, 22, 21, *DARK)
    # Beveled Inner Border
    draw_rect_outline(ox, oy, 7, 8, 18, 17, *STEEL_LIGHT)
    # Rivets
    for rx, ry in [(6, 7), (25, 7), (6, 25), (25, 25)]:
        set_pixel(ox + rx, oy + ry, *YELLOW_BRIGHT)
    # Center Dial Lock
    fill_rect(ox, oy, 11, 12, 10, 9, *STEEL_MID)
    draw_rect_outline(ox, oy, 11, 12, 10, 9, *DARK)
    fill_rect(ox, oy, 13, 14, 6, 5, *DARK)
    set_pixel(ox + 15, oy + 16, *ORANGE_BRIGHT)
    set_pixel(ox + 16, oy + 16, *ORANGE_BRIGHT)
    # Digital Status LED
    fill_rect(ox, oy, 13, 9, 6, 2, *RED_BRIGHT)

    # 5. prop_vault_door (128, 32)
    ox, oy = 128, 32
    # Heavy Bulkhead Arch
    fill_rect(ox, oy, 3, 3, 26, 26, *DARK)
    fill_rect(ox, oy, 5, 5, 22, 22, *STEEL_DARK)
    # Hazard Stripes Top & Bottom
    for sx in range(5, 26, 4):
        fill_rect(ox, oy, sx, 5, 2, 3, *ORANGE_BRIGHT)
        fill_rect(ox, oy, sx, 24, 2, 3, *ORANGE_BRIGHT)
    # Center Sealed Blast Split
    fill_rect(ox, oy, 14, 8, 4, 16, *DARK)
    draw_rect_outline(ox, oy, 13, 12, 6, 8, *ORANGE_BRIGHT)
    fill_rect(ox, oy, 14, 14, 4, 4, *RED_BRIGHT)
    # Hydraulic Pistons
    fill_rect(ox, oy, 7, 10, 5, 2, *STEEL_LIGHT)
    fill_rect(ox, oy, 20, 10, 5, 2, *STEEL_LIGHT)
    fill_rect(ox, oy, 7, 20, 5, 2, *STEEL_LIGHT)
    fill_rect(ox, oy, 20, 20, 5, 2, *STEEL_LIGHT)

    # 6. prop_cooling_vent_ready (160, 32)
    ox, oy = 160, 32
    # Floor Grate Outer Frame
    fill_rect(ox, oy, 4, 6, 24, 20, *STEEL_DARK)
    draw_rect_outline(ox, oy, 4, 6, 24, 20, *DARK)
    # Bolts on corners
    for bx, by in [(5, 7), (26, 7), (5, 24), (26, 24)]:
        set_pixel(ox + bx, oy + by, *CYAN_BRIGHT)
    # Interior Glow Well
    fill_rect(ox, oy, 7, 9, 18, 14, *CYAN_DARK)
    # Grate slats with Cyan / Ice Frost
    for sy in range(10, 22, 2):
        fill_rect(ox, oy, 8, sy, 16, 1, *DARK)
        fill_rect(ox, oy, 10, sy + 1, 12, 1, *CYAN_BRIGHT)
    # Frost particles
    for fx, fy in [(12, 4), (19, 5), (15, 3), (22, 4)]:
        set_pixel(ox + fx, oy + fy, *WHITE)

    # 7. prop_dead_drop (192, 32)
    ox, oy = 192, 32
    # Covert Floor Hatch
    fill_rect(ox, oy, 6, 8, 20, 18, *STEEL_DARK)
    draw_rect_outline(ox, oy, 6, 8, 20, 18, *DARK)
    fill_rect(ox, oy, 8, 10, 16, 14, *STEEL_MID)
    # Hatch handle
    fill_rect(ox, oy, 13, 19, 6, 2, *DARK)
    # Concealed Transmitter Antenna
    fill_rect(ox, oy, 15, 6, 2, 8, *STEEL_LIGHT)
    set_pixel(ox + 15, oy + 5, *ORANGE_BRIGHT)
    set_pixel(ox + 16, oy + 5, *ORANGE_BRIGHT)
    # Signal Waves
    set_pixel(ox + 13, oy + 4, *ORANGE_BRIGHT)
    set_pixel(ox + 18, oy + 4, *ORANGE_BRIGHT)
    set_pixel(ox + 11, oy + 3, *YELLOW_BRIGHT)
    set_pixel(ox + 20, oy + 3, *YELLOW_BRIGHT)

    # 8. prop_stabilizer (224, 32)
    ox, oy = 224, 32
    # Base Pylon Spire
    fill_rect(ox, oy, 6, 24, 20, 6, *STEEL_DARK)
    draw_rect_outline(ox, oy, 6, 24, 20, 6, *DARK)
    # Dual Tuning Fork Arms
    fill_rect(ox, oy, 8, 8, 3, 16, *STEEL_MID)
    fill_rect(ox, oy, 21, 8, 3, 16, *STEEL_MID)
    set_pixel(ox + 8, oy + 7, *CYAN_BRIGHT)
    set_pixel(ox + 23, oy + 7, *CYAN_BRIGHT)
    # Central Chronosphere Core
    fill_rect(ox, oy, 12, 10, 8, 8, *VIOLET_MID)
    draw_rect_outline(ox, oy, 12, 10, 8, 8, *VIOLET_BRIGHT)
    fill_rect(ox, oy, 14, 12, 4, 4, *CYAN_BRIGHT)
    fill_rect(ox, oy, 15, 13, 2, 2, *WHITE)
    # Orbiting Energy Sparkles
    set_pixel(ox + 10, oy + 14, *CYAN_BRIGHT)
    set_pixel(ox + 21, oy + 13, *CYAN_BRIGHT)

    # 9. prop_subnet_console (128, 64)
    ox, oy = 128, 64
    # Console Base
    fill_rect(ox, oy, 4, 18, 24, 11, *STEEL_DARK)
    draw_rect_outline(ox, oy, 4, 18, 24, 11, *DARK)
    # Dual Angled Monitors
    fill_rect(ox, oy, 5, 4, 10, 13, *DARK)
    draw_rect_outline(ox, oy, 5, 4, 10, 13, *STEEL_LIGHT)
    fill_rect(ox, oy, 17, 4, 10, 13, *DARK)
    draw_rect_outline(ox, oy, 17, 4, 10, 13, *STEEL_LIGHT)
    # Matrix Green Code Streams
    for cy in [6, 8, 10, 12, 14]:
        set_pixel(ox + 7, oy + cy, *GREEN_BRIGHT)
        set_pixel(ox + 10, oy + cy, *GREEN_MID)
        set_pixel(ox + 19, oy + cy, *GREEN_MID)
        set_pixel(ox + 23, oy + cy, *GREEN_BRIGHT)
    # Console Interface
    fill_rect(ox, oy, 8, 20, 16, 3, *DARK)
    set_pixel(ox + 10, oy + 21, *CYAN_BRIGHT)
    set_pixel(ox + 14, oy + 21, *GREEN_BRIGHT)
    set_pixel(ox + 18, oy + 21, *YELLOW_BRIGHT)

    # 10. prop_crate_cover (160, 64)
    ox, oy = 160, 64
    # Military Carbon Crate Body
    fill_rect(ox, oy, 4, 8, 24, 20, *STEEL_DARK)
    draw_rect_outline(ox, oy, 4, 8, 24, 20, *DARK)
    # Corner Bumpers
    for cx, cy in [(4, 8), (24, 8), (4, 24), (24, 24)]:
        fill_rect(ox, oy, cx, cy, 4, 4, *STEEL_LIGHT)
    # Cross Braces
    for d in range(16):
        set_pixel(ox + 8 + d, oy + 10 + d, *DARK)
        set_pixel(ox + 23 - d, oy + 10 + d, *DARK)
    # Center Stencil Badge
    fill_rect(ox, oy, 12, 15, 8, 6, *ORANGE_BRIGHT)
    draw_rect_outline(ox, oy, 12, 15, 8, 6, *DARK)

    # 11. prop_cryo_vat (192, 64)
    ox, oy = 192, 64
    # Top and Bottom Metal Rings
    fill_rect(ox, oy, 6, 3, 20, 5, *STEEL_MID)
    draw_rect_outline(ox, oy, 6, 3, 20, 5, *DARK)
    fill_rect(ox, oy, 6, 24, 20, 6, *STEEL_MID)
    draw_rect_outline(ox, oy, 6, 24, 20, 6, *DARK)
    # Glass Cylinder & Cyan Liquid
    fill_rect(ox, oy, 8, 8, 16, 16, *CYAN_DARK)
    draw_rect_outline(ox, oy, 7, 8, 18, 16, *STEEL_LIGHT)
    # Bubbles & Specimen Shadow
    fill_rect(ox, oy, 13, 11, 6, 10, *DARK)
    set_pixel(ox + 10, oy + 12, *CYAN_BRIGHT)
    set_pixel(ox + 11, oy + 18, *CYAN_BRIGHT)
    set_pixel(ox + 21, oy + 14, *CYAN_BRIGHT)
    set_pixel(ox + 20, oy + 20, *CYAN_BRIGHT)

    # 12. prop_capacitor_bank (224, 64)
    ox, oy = 224, 64
    # Capacitor Platform
    fill_rect(ox, oy, 5, 23, 22, 6, *STEEL_DARK)
    draw_rect_outline(ox, oy, 5, 23, 22, 6, *DARK)
    # 3 High Voltage Coils
    for cx in [7, 14, 21]:
        fill_rect(ox, oy, cx, 8, 4, 15, *ORANGE_MID)
        draw_rect_outline(ox, oy, cx, 8, 4, 15, *DARK)
        # Ribbed insulators
        for ry in [10, 13, 16, 19]:
            fill_rect(ox, oy, cx - 1, ry, 6, 1, *ORANGE_BRIGHT)
    # Lightning Arc / Spark between coils
    set_pixel(ox + 10, oy + 7, *YELLOW_BRIGHT)
    set_pixel(ox + 12, oy + 6, *WHITE)
    set_pixel(ox + 15, oy + 7, *YELLOW_BRIGHT)
    set_pixel(ox + 18, oy + 6, *WHITE)
    set_pixel(ox + 20, oy + 7, *YELLOW_BRIGHT)

    # 13. item_access_key (128, 96)
    ox, oy = 128, 96
    # Golden / Amber RFID Card
    fill_rect(ox, oy, 7, 8, 18, 16, *ORANGE_BRIGHT)
    draw_rect_outline(ox, oy, 7, 8, 18, 16, *DARK)
    fill_rect(ox, oy, 9, 10, 14, 12, *YELLOW_BRIGHT)
    # Smart Chip Gold Contacts
    fill_rect(ox, oy, 11, 13, 6, 6, *DARK)
    draw_rect_outline(ox, oy, 11, 13, 6, 6, *ORANGE_BRIGHT)
    fill_rect(ox, oy, 13, 15, 2, 2, *WHITE)
    # Lanyard slot
    fill_rect(ox, oy, 21, 15, 2, 3, *DARK)

    # 14. item_scavenger_siphon (160, 96)
    ox, oy = 160, 96
    # Siphon Wafer Module
    fill_rect(ox, oy, 8, 8, 16, 16, *STEEL_DARK)
    draw_rect_outline(ox, oy, 8, 8, 16, 16, *DARK)
    fill_rect(ox, oy, 10, 10, 12, 12, *CYAN_MID)
    # Micro-siphon prongs
    fill_rect(ox, oy, 11, 4, 2, 4, *CYAN_BRIGHT)
    fill_rect(ox, oy, 19, 4, 2, 4, *CYAN_BRIGHT)
    # Circuit Lines
    set_pixel(ox + 13, oy + 13, *WHITE)
    set_pixel(ox + 15, oy + 13, *WHITE)
    set_pixel(ox + 17, oy + 13, *WHITE)
    set_pixel(ox + 15, oy + 16, *CYAN_BRIGHT)

    # 15. item_kinetic_breacher (192, 96)
    ox, oy = 192, 96
    # Explosive Pack Body
    fill_rect(ox, oy, 7, 9, 18, 14, *RED_BRIGHT)
    draw_rect_outline(ox, oy, 7, 9, 18, 14, *DARK)
    # Magnetic clamps on sides
    fill_rect(ox, oy, 5, 12, 2, 8, *STEEL_LIGHT)
    fill_rect(ox, oy, 25, 12, 2, 8, *STEEL_LIGHT)
    # Detonator Unit & LED Timer
    fill_rect(ox, oy, 11, 12, 10, 7, *DARK)
    fill_rect(ox, oy, 13, 14, 6, 3, *ORANGE_BRIGHT)
    set_pixel(ox + 15, oy + 15, *YELLOW_BRIGHT)

    # 16. item_thermal_bypass (224, 96)
    ox, oy = 224, 96
    # Copper Core
    fill_rect(ox, oy, 8, 8, 16, 16, *ORANGE_BRIGHT)
    draw_rect_outline(ox, oy, 8, 8, 16, 16, *DARK)
    # Cooling fins radiating out
    for fy in range(9, 23, 3):
        fill_rect(ox, oy, 6, fy, 2, 2, *CYAN_BRIGHT)
        fill_rect(ox, oy, 24, fy, 2, 2, *CYAN_BRIGHT)
    # Center Thermal Vent
    fill_rect(ox, oy, 12, 12, 8, 8, *RED_BRIGHT)
    fill_rect(ox, oy, 14, 14, 4, 4, *YELLOW_BRIGHT)
    fill_rect(ox, oy, 15, 15, 2, 2, *WHITE)

    # Compress and write updated PNG
    new_idat = zlib.compress(bytes(raw), 9)

    out_chunks = []
    out_chunks.append((b'IHDR', ihdr))
    out_chunks.append((b'IDAT', new_idat))
    out_chunks.append((b'IEND', b''))

    out_content = bytearray(b'\x89PNG\r\n\x1a\n')
    for ctype, cdata in out_chunks:
        out_content.extend(struct.pack('>I', len(cdata)))
        out_content.extend(ctype)
        out_content.extend(cdata)
        crc = zlib.crc32(ctype + cdata)
        out_content.extend(struct.pack('>I', crc))

    with open(png_path, 'wb') as f:
        f.write(out_content)
    print('Updated public/assets/tileset.png successfully!')

if __name__ == '__main__':
    create_tileset_props()
