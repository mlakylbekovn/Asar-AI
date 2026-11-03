# ASAR AI жобасын GitHub-қа шығару

Жоба ұсынылатын репозиторий атауы: `asar-ai-mobile`.

## Веб арқылы

1. GitHub-та `New repository` таңда, атауы `asar-ai-mobile`, `Private` немесе `Public` таңдауын өзің жаса. Тек оқу жобасын көрсеткің келсе, жеке деректер жоқ екеніне көз жеткіз.
2. Егер осы ZIP-ті қолдансаң, алдымен архивті аш.
3. Жаңа репозиторийдің `Add file` → `Upload files` бөлімінен файлдар мен `src/`, `tests/`, `assets/`, `.github/` бумаларын жүкте. `.gitignore` мен `.github` жасырын файлдары да қосылғанын тексер.
4. `Commit changes` бас. Сосын `README.md` ашылып тұрғанын және Actions ішіндегі тест өтіп жатқанын тексер.

## Компьютердегі Git арқылы (Git орнатылған болса)

Папканы ашып, командаларды орында:

```bash
git init
git add .
git commit -m "Initial ASAR AI Mobile MVP"
git branch -M main
git remote add origin https://github.com/USERNAME/asar-ai-mobile.git
git push -u origin main
```

`USERNAME` бөлігін GitHub аккаунтыңмен алмастыр. Алдымен GitHub-та бос репозиторийді жаса; оған README-ді автоматты түрде қосып қойма.

**Ескерту:** Бұл ZIP — GitHub-қа жарияланған репозиторий емес; кодты өз аккаунтыңа жіберуді аяқтау қажет.
