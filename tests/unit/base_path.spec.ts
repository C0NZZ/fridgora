import '#tests/test_context'
import { test } from '@japa/runner'
import { prefixAppPath, resolveBasePath } from '#helpers/base_path'

test.group('Base path', () => {
  test('uses the public URL unless an explicit path overrides it', ({ assert }) => {
    assert.equal(resolveBasePath(), '')
    assert.equal(resolveBasePath('', 'https://example.com'), '')
    assert.equal(resolveBasePath('', 'https://example.com/office/fridgora/'), '/office/fridgora')
    assert.equal(resolveBasePath('/kiosk/', 'https://example.com/fridgora'), '/kiosk')
    assert.equal(resolveBasePath('/', 'https://example.com/fridgora'), '')
  })

  test('rejects invalid mount paths', ({ assert }) => {
    for (const path of [
      'fridgora',
      '//host',
      '/a//b',
      '/a/../b',
      '/a/./b',
      '/a?b',
      '/%2f',
      '/a#b',
    ]) {
      assert.throws(() => resolveBasePath(path), /APP_BASE_PATH/)
    }
  })

  test('prefixes local paths and leaves other URLs intact', ({ assert }) => {
    const basePath = '/office/kiosk'
    assert.equal(prefixAppPath(basePath, '/kiosk?keypadId=42'), '/office/kiosk/kiosk?keypadId=42')
    assert.equal(prefixAppPath(basePath, '/'), '/office/kiosk/')
    assert.equal(
      prefixAppPath(basePath, 'https://example.com/product.png'),
      'https://example.com/product.png'
    )
    assert.equal(prefixAppPath(basePath, '//example.com/product.png'), '//example.com/product.png')
  })
})
