import asyncio, os, logging
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.state import StatesGroup, State
from aiogram.fsm.context import FSMContext
from bot.db import init_db, create_request, get_request, list_requests, set_status, user_requests
from bot.keyboards import main_menu, items_menu, periods_menu, admin_menu, admin_actions

load_dotenv()
logging.basicConfig(level=logging.INFO)
TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_IDS = {int(v.strip()) for v in os.getenv("ADMIN_IDS", "").split(",") if v.strip().isdigit()}
OWNER_CONTACT = os.getenv("OWNER_CONTACT", "@your_username")
if not TOKEN:
    raise RuntimeError("Set BOT_TOKEN in environment or .env")

bot = Bot(TOKEN)
dp = Dispatcher()

class RequestNote(StatesGroup):
    note = State()

def admin(user_id): return user_id in ADMIN_IDS

def format_request(r):
    return (f"Заявка #{r['id']}\\n"
            f"Категория: {r['item_type']}\\n"
            f"Позиция: {r['item_name']}\\n"
            f"Срок: {r['period']}\\n"
            f"Пользователь: @{r['username'] or 'не указан'} (ID {r['user_id']})\\n"
            f"Статус: {r['status']}\\n"
            f"Комментарий: {r['note'] or '—'}\\n"
            f"Создана: {r['created_at']}")

@dp.message(CommandStart())
async def start(m: Message):
    text = ("🖼 NFT RENT — Аренда NFT\\n\\n"
            "🎁 NFT-подарки\\n└ Уникальные подарки Telegram в аренду на выбранный срок.\\n\\n"
            "👤 NFT-юзернеймы\\n└ Подбор редких и красивых имён.\\n\\n"
            "☎️ NFT-номера\\n└ Подбор цифровых номеров +888.\\n\\n"
            "Выберите, что хотите арендовать 👇\\n\\n"
            "Оплата и передача согласуются напрямую с владельцем. Не отправляйте пароли или коды входа.")
    await m.answer(text, reply_markup=main_menu(admin(m.from_user.id)))

@dp.message(Command("admin"))
async def admin_cmd(m: Message):
    if not admin(m.from_user.id):
        return await m.answer("Нет доступа.")
    await m.answer("🛠 Админ-меню", reply_markup=admin_menu())

@dp.callback_query(F.data == "home")
async def home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await c.message.answer("Главное меню 👇", reply_markup=main_menu(admin(c.from_user.id)))
    await c.answer()

@dp.callback_query(F.data.startswith("catalog:"))
async def catalog(c: CallbackQuery):
    kind = c.data.split(":")[1]
    titles = {"gifts": "🎁 Выберите NFT-подарок", "usernames": "👤 NFT-юзернеймы", "numbers": "☎️ NFT-номера"}
    await c.message.answer(titles.get(kind, "Каталог"), reply_markup=items_menu(kind))
    await c.answer()

@dp.callback_query(F.data.startswith("item:"))
async def item(c: CallbackQuery):
    _, kind, item_name = c.data.split(":", 2)
    await c.message.answer(
        f"Вы выбрали: {item_name}\\n\\nВыберите желаемый срок аренды. Стоимость и доступность владелец подтвердит лично.",
        reply_markup=periods_menu(kind, item_name)
    )
    await c.answer()

@dp.callback_query(F.data.startswith("period:"))
async def period(c: CallbackQuery, state: FSMContext):
    _, kind, period_val, item_name = c.data.split(":", 3)
    await state.update_data(kind=kind, period=period_val, item_name=item_name)
    await state.set_state(RequestNote.note)
    await c.message.answer("Добавьте комментарий для владельца (или отправьте «-», если комментария нет). Не отправляйте секретные данные.")
    await c.answer()

@dp.message(RequestNote.note)
async def note_received(m: Message, state: FSMContext):
    data = await state.get_data()
    note = (m.text or "").strip()
    if note == "-": note = ""
    if len(note) > 500:
        return await m.answer("Комментарий слишком длинный. Максимум 500 символов.")
    rid = create_request(m.from_user.id, m.from_user.username, data["kind"], data["item_name"], data["period"], note)
    await state.clear()
    await m.answer(f"✅ Заявка #{rid} отправлена владельцу. Он свяжется с вами для согласования стоимости и оплаты.")
    r = get_request(rid)
    for aid in ADMIN_IDS:
        try:
            await bot.send_message(aid, format_request(r), reply_markup=admin_actions(rid))
        except Exception:
            logging.exception("Admin notify failed")

@dp.callback_query(F.data == "my_requests")
async def mine(c: CallbackQuery):
    rows = user_requests(c.from_user.id)
    if not rows:
        await c.message.answer("У вас пока нет заявок.")
    else:
        for r in rows:
            await c.message.answer(f"Заявка #{r['id']} · {r['item_name']} · {r['period']} · {r['status']}")
    await c.answer()

@dp.callback_query(F.data == "owner")
async def owner(c: CallbackQuery):
    await c.message.answer(f"Связь с владельцем: {OWNER_CONTACT}\\nНапишите ему для уточнения цены, оплаты и условий аренды.")
    await c.answer()

@dp.callback_query(F.data == "admin")
async def admin_panel(c: CallbackQuery):
    if not admin(c.from_user.id):
        return await c.answer("Нет доступа", show_alert=True)
    await c.message.answer("🛠 Админ-меню", reply_markup=admin_menu())
    await c.answer()

@dp.callback_query(F.data.startswith("admin:"))
async def admin_list(c: CallbackQuery):
    if not admin(c.from_user.id):
        return await c.answer("Нет доступа", show_alert=True)
    mode = c.data.split(":")[1]
    rows = list_requests(status="new" if mode == "new" else None, limit=25)
    if not rows:
        await c.message.answer("Заявок нет.")
    else:
        for r in rows:
            await c.message.answer(format_request(r), reply_markup=admin_actions(r["id"]))
    await c.answer()

@dp.callback_query(F.data.startswith("status:"))
async def change_status(c: CallbackQuery):
    if not admin(c.from_user.id):
        return await c.answer("Нет доступа", show_alert=True)
    _, status, raw_id = c.data.split(":")
    rid = int(raw_id)
    r = get_request(rid)
    if not r:
        return await c.answer("Заявка не найдена", show_alert=True)
    set_status(rid, status)
    try:
        await bot.send_message(r["user_id"], f"Обновление по заявке #{rid}: статус — {status}.")
    except Exception:
        pass
    await c.message.answer(f"Статус заявки #{rid} изменён: {status}.")
    await c.answer("Готово")

async def main():
    init_db()
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
