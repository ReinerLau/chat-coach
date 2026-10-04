#include <Security/Security.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
  if (argc != 4 || (strcmp(argv[1], "get") && strcmp(argv[1], "set"))) return 2;
  const char *service = argv[2], *account = argv[3];
  if (!strcmp(argv[1], "get")) {
    UInt32 length = 0; void *password = NULL;
    OSStatus code = SecKeychainFindGenericPassword(NULL, (UInt32)strlen(service), service,
      (UInt32)strlen(account), account, &length, &password, NULL);
    if (code != errSecSuccess) return 3;
    if (fwrite(password, 1, length, stdout) != length) { SecKeychainItemFreeContent(NULL, password); return 4; }
    SecKeychainItemFreeContent(NULL, password);
    return 0;
  }
  char key[128];
  if (!fgets(key, sizeof(key), stdin)) return 5;
  size_t length = strcspn(key, "\r\n"); key[length] = '\0';
  if (length < 24 || length > 127) return 6;
  SecKeychainItemRef item = NULL;
  OSStatus code = SecKeychainFindGenericPassword(NULL, (UInt32)strlen(service), service,
    (UInt32)strlen(account), account, NULL, NULL, &item);
  if (code == errSecSuccess) {
    code = SecKeychainItemModifyAttributesAndData(item, NULL, (UInt32)length, key);
    CFRelease(item);
  } else if (code == errSecItemNotFound) {
    code = SecKeychainAddGenericPassword(NULL, (UInt32)strlen(service), service,
      (UInt32)strlen(account), account, (UInt32)length, key, NULL);
  }
  memset(key, 0, sizeof(key));
  return code == errSecSuccess ? 0 : 7;
}
