# Доступ к droplet 157.230.246.177

## Доступ агента (Cursor / LLM)

**Агент может подключаться к droplet** через SSH (как и владелец): `ssh root@157.230.246.177`

**Важно:** Все действия агента на droplet требуют явного подтверждения владельца. Агент не выполняет команды на сервере (deploy, рестарты, изменения в БД, импорты и т.п.) без согласия пользователя.

---

## Диагностика (историческая)

- ✅ SSH‑ключ есть: `~/.ssh/id_ed25519`
- ✅ Подключение по сети работает
- ✅ Ключ добавлен в `authorized_keys`

## Твой публичный ключ (скопируй целиком)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICJIIaNpLSiS1d1oACAsLmJigqmuhVPutD3EqYbFB87L yavleninma@gmail.com
```

## Как добавить ключ на droplet

### Вариант A: Recovery Console (DigitalOcean)

1. Зайди в [cloud.digitalocean.com](https://cloud.digitalocean.com) → Droplets → твой droplet
2. **Access** → **Launch Recovery Console**
3. Войди как `root` (пароль из письма при создании droplet, или Reset Root Password)
4. Выполни:

```bash
mkdir -p ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICJIIaNpLSiS1d1oACAsLmJigqmuhVPutD3EqYbFB87L yavleninma@gmail.com" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Вариант B: Если есть другой способ входа (пароль, другой ключ)

На сервере в `~/.ssh/authorized_keys` добавить строку с публичным ключом выше.

---

## После добавления ключа

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@157.230.246.177
```

Или просто:

```powershell
ssh root@157.230.246.177
```

(Windows использует `id_ed25519` по умолчанию, если в `~/.ssh/` нет других ключей.)
