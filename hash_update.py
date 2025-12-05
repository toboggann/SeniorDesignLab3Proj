import sys

def hash_password(password: str) -> str:
    hash_val = 0
    for ch in password:
        char = ord(ch)
        hash_val = ((hash_val << 5) - hash_val) + char
        hash_val = hash_val & 0xFFFFFFFF

    if hash_val & 0x80000000:
        hash_val = -((~hash_val & 0xFFFFFFFF) + 1)

    return format(hash_val, "x")

def update_env(new_password: str):
    hashed = hash_password(new_password)
    print("New hashed password:", hashed)

    with open(".env", "w") as f:
        f.write(f"LAB_PASSWORD_HASH={hashed}\n")

    print("Updated .env successfully.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 hash_update.py <newPassword>")
        sys.exit(1)

    update_env(sys.argv[1])
