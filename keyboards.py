from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def main_menu(is_admin=False):
    rows = [
        [InlineKeyboardButton(text="🎁 NFT-подарки", callback_data="catalog:gifts")],
        [InlineKeyboardButton(text="👤 NFT-юзернеймы", callback_data="catalog:usernames")],
        [InlineKeyboardButton(text="☎️ NFT-номера", callback_data="catalog:numbers")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="👨‍💻 Связаться с владельцем", callback_data="owner")],
    ]
    if is_admin:
        rows.append([InlineKeyboardButton(text="🛠 Админ-меню", callback_data="admin")])
    return InlineKeyboardMarkup(inline_keyboard=rows)

def items_menu(kind):
    if kind == "gifts":
        items = [
            ("🏆 Algorithm Cups", "Algorithm Cups"),
            ("🕶 Durov's Glasses", "Durov's Glasses"),
            ("🕊 Rare Bird", "Rare Bird"),
            ("🐸 Plush Pepe", "Plush Pepe"),
            ("💝 Heart Locket", "Heart Locket"),
            ("🧢 Durov's Cap", "Durov's Cap"),
            ("🍑 Precious Peach", "Precious Peach"),
            ("🪖 Heroic Helmet", "Heroic Helmet"),
            ("💪 Mighty Arm", "Mighty Arm"),
            ("💍 Nail Bracelet", "Nail Bracelet"),
        ]
    elif kind == "usernames":
        items = [("🔎 Подобрать юзернейм", "Подбор NFT-юзернейма")]
    else:
        items = [("☎️ Подобрать номер +888", "Подбор NFT-номера +888")]
    rows = [[InlineKeyboardButton(text=label, callback_data=f"item:{kind}:{value}")] for label, value in items]
    rows += [[InlineKeyboardButton(text="⬅️ В меню", callback_data="home")]]
    return InlineKeyboardMarkup(inline_keyboard=rows)

def periods_menu(kind, item_name):
    rows = []
    for label, val in [("1 сутки", "1 сутки"), ("3 суток", "3 суток"), ("7 суток", "7 суток"), ("30 суток", "30 суток")]:
        rows.append([InlineKeyboardButton(text=f"🗓 {label}", callback_data=f"period:{kind}:{val}:{item_name}")])
    rows.append([InlineKeyboardButton(text="⬅️ Назад", callback_data=f"catalog:{kind}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)

def admin_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🆕 Новые заявки", callback_data="admin:new")],
        [InlineKeyboardButton(text="📚 Все заявки", callback_data="admin:all")],
        [InlineKeyboardButton(text="⬅️ В меню", callback_data="home")]
    ])

def admin_actions(rid):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🟡 В работе", callback_data=f"status:in_progress:{rid}")],
        [InlineKeyboardButton(text="✅ Завершено", callback_data=f"status:completed:{rid}"),
         InlineKeyboardButton(text="❌ Отказ", callback_data=f"status:rejected:{rid}")]
    ])
