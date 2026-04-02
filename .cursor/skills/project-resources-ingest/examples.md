# Examples

## URL → res

- Icon pack from `https://cdn.example.com/pkg/icons/home.svg`  
  → `res/vendor/example/icons/home.svg`
- Font `https://fonts.example.com/static/Roboto.woff2`  
  → `res/fonts/roboto/Roboto.woff2`

## Local path → res

- `D:/refs/mockup.png` (user: “put a copy in the repo”)  
  → `res/local/refs/mockup.png`
- Shared library `C:/Lib/foo.dll` needed for a Windows demo  
  → `res/bin/windows/foo.dll`

## Collision

- Second download also named `logo.png`  
  → `res/images/logo-2.png` or `res/images/logo-a1b2c3d4.png`
