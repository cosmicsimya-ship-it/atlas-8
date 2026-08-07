import urllib.request

b = urllib.request.urlopen("https://cosmicsimya.com/", timeout=40).read().decode("utf-8", "replace")
checks = {
    "instagram.com": "instagram.com" in b.lower(),
    "t.me": "t.me/" in b.lower(),
    "Atlaspatenbot": "Atlaspatenbot" in b,
    "seo_title": "Cosmic Simya | Atlas" in b,
    "nav_Cosmicsimya": "Cosmicsimya" in b,
    "HashRouter_string": "HashRouter" in b,
}
for k, v in checks.items():
    print(f"{k}={v}")
print("home_kb", round(len(b) / 1024, 1))
robots = urllib.request.urlopen("https://cosmicsimya.com/robots.txt", timeout=20).read().decode("utf-8", "replace")
print("ROBOTS_REPR", repr(robots))
