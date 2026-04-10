from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets' / 'images'
FONT_PATH = ROOT / 'node_modules' / '@expo-google-fonts' / 'playfair-display' / '700Bold' / 'PlayfairDisplay_700Bold.ttf'

BLUSH_TOP = (255, 242, 243, 255)
BLUSH_BOTTOM = (255, 248, 241, 255)
BLUSH_DEEP = (249, 228, 233, 255)
GOLD_LIGHT = (247, 232, 187, 255)
GOLD_MID = (234, 210, 144, 255)
GOLD_DEEP = (211, 172, 86, 255)
SHADOW = (120, 88, 36, 54)
MONO = (23, 18, 15, 255)


def vertical_gradient(size, top, bottom):
    width, height = size
    image = Image.new('RGBA', size)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(height - 1, 1)
        color = tuple(round(top[i] * (1 - ratio) + bottom[i] * ratio) for i in range(4))
        draw.line((0, y, width, y), fill=color)
    return image


def horizontal_gradient(size, left, middle, right):
    width, height = size
    image = Image.new('RGBA', size)
    draw = ImageDraw.Draw(image)
    for x in range(width):
        ratio = x / max(width - 1, 1)
        if ratio <= 0.5:
            local = ratio / 0.5
            color = tuple(round(left[i] * (1 - local) + middle[i] * local) for i in range(4))
        else:
            local = (ratio - 0.5) / 0.5
            color = tuple(round(middle[i] * (1 - local) + right[i] * local) for i in range(4))
        draw.line((x, 0, x, height), fill=color)
    return image


def tracked_text_box(text, font, tracking):
    width = 0
    top = 0
    bottom = 0
    for index, char in enumerate(text):
        left, char_top, right, char_bottom = font.getbbox(char)
        width += right - left
        if index < len(text) - 1:
            width += tracking
        top = min(top, char_top)
        bottom = max(bottom, char_bottom)
    return width, top, bottom


def draw_tracked_text(draw, position, text, font, fill, tracking):
    x, y = position
    for index, char in enumerate(text):
        draw.text((x, y), char, font=font, fill=fill)
        left, _, right, _ = font.getbbox(char)
        x += right - left
        if index < len(text) - 1:
            x += tracking


def tracked_text_mask(size, text, font, tracking, origin):
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw_tracked_text(draw, origin, text, font, 255, tracking)
    return mask


def fit_font(text, max_width, max_height, tracking, start_size):
    size = start_size
    while size > 10:
        font = ImageFont.truetype(str(FONT_PATH), size)
        width, top, bottom = tracked_text_box(text, font, tracking)
        height = bottom - top
        if width <= max_width and height <= max_height:
            return font, width, top, bottom
        size -= 2
    raise RuntimeError('Unable to fit text')


def add_shadow(base, mask, offset, blur_radius, color):
    shadow = Image.new('RGBA', base.size, (0, 0, 0, 0))
    shadow_mask = Image.new('L', base.size, 0)
    ox, oy = offset
    shadow_mask.paste(mask, (ox, oy))
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    shadow.paste(color, (0, 0), shadow_mask)
    return Image.alpha_composite(base, shadow)


def apply_mask_gradient(base, mask, gradient):
    gradient = gradient.copy()
    gradient.putalpha(mask)
    return Image.alpha_composite(base, gradient)


def add_frame(base, inset, color, width):
    overlay = Image.new('RGBA', base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    radius = max(12, base.size[0] // 6)
    draw.rounded_rectangle((inset, inset, base.size[0] - inset, base.size[1] - inset), radius=radius, outline=color, width=width)
    return Image.alpha_composite(base, overlay)


def add_glow(base, ellipse_box, fill, blur_radius):
    overlay = Image.new('RGBA', base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse(ellipse_box, fill=fill)
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur_radius))
    return Image.alpha_composite(base, overlay)


def create_wordmark():
    size = (1600, 360)
    text = 'NDOLOLY'
    tracking = 26
    font, text_width, top, bottom = fit_font(text, 1300, 150, tracking, 126)
    text_height = bottom - top
    text_x = (size[0] - text_width) // 2
    text_y = 72 - top
    mask = tracked_text_mask(size, text, font, tracking, (text_x, text_y))

    base = Image.new('RGBA', size, (0, 0, 0, 0))
    base = add_shadow(base, mask, (0, 6), 9, SHADOW)
    text_gradient = horizontal_gradient(size, GOLD_LIGHT, GOLD_MID, GOLD_LIGHT)
    base = apply_mask_gradient(base, mask, text_gradient)

    overlay = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    rule_width = int(text_width * 0.92)
    rule_x = (size[0] - rule_width) // 2
    rule_y = text_y + text_height + 58
    draw.rounded_rectangle((rule_x, rule_y, rule_x + rule_width, rule_y + 8), radius=999, fill=GOLD_MID)
    overlay = overlay.filter(ImageFilter.GaussianBlur(0.4))
    base = Image.alpha_composite(base, overlay)
    base.save(ASSETS / 'brand-wordmark.png')


def create_icon_background(size):
    width, height = size
    glow_margin_x = max(8, width // 6)
    glow_margin_y = max(8, height // 7)
    lower_glow_margin_x = max(10, width // 4)
    lower_glow_top = max(glow_margin_y + 6, height // 3)
    lower_glow_bottom = max(lower_glow_top + 12, height - max(10, height // 8))
    image = vertical_gradient(size, BLUSH_TOP, BLUSH_BOTTOM)
    image = add_glow(
        image,
        (glow_margin_x, glow_margin_y, width - glow_margin_x, height - max(10, height // 5)),
        (255, 255, 255, 90),
        max(6, width // 25),
    )
    image = add_glow(
        image,
        (lower_glow_margin_x, lower_glow_top, width - lower_glow_margin_x, lower_glow_bottom),
        (245, 220, 165, 55),
        max(8, width // 22),
    )
    image = add_frame(image, max(4, width // 24), (233, 207, 150, 135), max(2, width // 170))
    return image


def create_monogram_layer(size, color_mode='gold'):
    text = 'N'
    font = ImageFont.truetype(str(FONT_PATH), int(size[1] * 0.56))
    left, top, right, bottom = font.getbbox(text)
    text_width = right - left
    text_height = bottom - top
    text_x = (size[0] - text_width) // 2 - left
    text_y = int(size[1] * 0.18) - top
    mask = tracked_text_mask(size, text, font, 0, (text_x, text_y))

    line_mask = Image.new('L', size, 0)
    line_draw = ImageDraw.Draw(line_mask)
    line_width = int(size[0] * 0.28)
    line_height = max(6, size[0] // 70)
    line_x = (size[0] - line_width) // 2
    line_y = text_y + text_height + int(size[1] * 0.05)
    line_draw.rounded_rectangle((line_x, line_y, line_x + line_width, line_y + line_height), radius=999, fill=255)

    full_mask = Image.new('L', size, 0)
    full_mask.paste(mask, (0, 0))
    full_mask = Image.composite(Image.new('L', size, 255), full_mask, line_mask)

    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    if color_mode == 'gold':
        layer = add_shadow(layer, full_mask, (0, max(4, size[0] // 120)), max(5, size[0] // 120), SHADOW)
        gradient = horizontal_gradient(size, GOLD_LIGHT, GOLD_MID, GOLD_DEEP)
        layer = apply_mask_gradient(layer, full_mask, gradient)
    else:
        solid = Image.new('RGBA', size, MONO)
        solid.putalpha(full_mask)
        layer = Image.alpha_composite(layer, solid)
    return layer


def create_icon():
    size = (1024, 1024)
    background = create_icon_background(size)
    monogram = create_monogram_layer(size)
    Image.alpha_composite(background, monogram).convert('RGB').save(ASSETS / 'icon.png')


def create_favicon():
    size = (48, 48)
    background = create_icon_background(size)
    monogram = create_monogram_layer(size)
    Image.alpha_composite(background, monogram).save(ASSETS / 'favicon.png')


def create_android_assets():
    bg = create_icon_background((512, 512))
    bg.save(ASSETS / 'android-icon-background.png')

    fg = create_monogram_layer((512, 512))
    fg.save(ASSETS / 'android-icon-foreground.png')

    mono = create_monogram_layer((432, 432), color_mode='mono')
    mono.save(ASSETS / 'android-icon-monochrome.png')


def create_splash():
    size = (1024, 1024)
    text = 'NDOLOLY'
    tracking = 18
    font, text_width, top, bottom = fit_font(text, 780, 120, tracking, 106)
    text_height = bottom - top
    text_x = (size[0] - text_width) // 2
    text_y = 344 - top
    mask = tracked_text_mask(size, text, font, tracking, (text_x, text_y))

    image = Image.new('RGBA', size, (0, 0, 0, 0))
    image = add_shadow(image, mask, (0, 6), 8, SHADOW)
    gradient = horizontal_gradient(size, GOLD_LIGHT, GOLD_MID, GOLD_LIGHT)
    image = apply_mask_gradient(image, mask, gradient)

    overlay = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    rule_width = int(text_width * 0.8)
    rule_x = (size[0] - rule_width) // 2
    rule_y = text_y + text_height + 42
    draw.rounded_rectangle((rule_x, rule_y, rule_x + rule_width, rule_y + 12), radius=999, fill=GOLD_MID)
    image = Image.alpha_composite(image, overlay)
    image.save(ASSETS / 'splash-icon.png')


def main():
    create_wordmark()
    create_icon()
    create_favicon()
    create_android_assets()
    create_splash()


if __name__ == '__main__':
    main()
