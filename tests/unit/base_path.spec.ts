import '#tests/test_context'
import { test } from '@japa/runner'
import { prefixAppPath, publicUrlAtBasePath, resolveBasePath } from '#helpers/base_path'

test.group('Base path', () => {
  test('builds a public URL from the origin and effective mount', ({ assert }) => {
    assert.equal(
      publicUrlAtBasePath('https://example.com:8443/old-path/', '/office/fridgora'),
      'https://example.com:8443/office/fridgora'
    )
    assert.equal(publicUrlAtBasePath('https://example.com/old-path/', ''), 'https://example.com')
  })

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
