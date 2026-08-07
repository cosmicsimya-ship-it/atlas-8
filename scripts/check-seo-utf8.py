import urllib.request
import re

b = urllib.request.urlopen("https://cosmicsimya.com/", timeout=40).read()
t = b.decode("utf-8")
print("TITLE", re.search(r"<title>(.*?)</title>", t).group(1))
m = re.search(r'name="description"\s+content="(.*?)"', t)
print("DESC", m.group(1) if m else None)
print("OK_UTF8", "Kişisel" in t and "örüntüleri" in t)
