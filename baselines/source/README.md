# /baselines/source

Thư mục này lưu **source zip baseline** sau mỗi vòng fix.

Quy ước file:
- `TSBIO_SRC_YYYYMMDD_vX.zip`

Quy trình (mỗi vòng):
1) Fix code
2) Test OK
3) Snapshot DB → `/baselines/database/`
4) Zip source → `/baselines/source/`
5) Update `/baselines/logs/changelog.md` + `BASELINE.md` + `CONTINUITY.md`
