# 코드 블록 샘플

코드 블록이 언어와 길이에 따라 어떻게 보이는지 확인하는 문서다. 본문 속 `인라인 코드`와 `mods/side-viewer/main.js` 같은 경로도 섞는다.

## 셸 명령

```sh
node --test mods/side-viewer/
herdr-app check mods/side-viewer
```

```bash
# 주석이 있는 셸
for f in docs/*.md; do
  echo "$f"
done
```

한 줄짜리:

```sh
git status --short
```

## 언어별

```js
// 언어가 적힌 코드 블록
export function greet(name) {
  return `hello, ${name}`;
}
```

```ts
type Answer = { path: string; at: number };
const answers: Answer[] = [];
```

```python
def greet(name: str) -> str:
    return f"hello, {name}"
```

```rust
fn main() {
    println!("hello");
}
```

```json
{ "place": "none", "title": "Side Viewer", "focusable": true }
```

```diff
- const width = 860;
+ const width = 680;
```

```
언어가 없는 코드 블록
```

## 긴 줄

```sh
herdr-app do pane.split --direction right --mod side-viewer --props '{"file":"/Users/me/projects/side-viewer/docs/samples/code-sample.md"}' && herdr-app status
```

## 목록 안의 코드

1. 먼저 검사를 돌린다.

   ```sh
   node --test mods/side-viewer/
   ```

2. 그다음 설치한다.

## 인용 안의 코드

> 이렇게 실행한다.
>
> ```sh
> herdr-app status
> ```
