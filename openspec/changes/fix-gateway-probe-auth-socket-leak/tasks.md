## 1. Specification & Review
- [x] 1.1 Promote idea to OpenSpec change scaffold.
- [x] 1.2 Define testable requirements and scenarios in spec.md.
- [x] 1.3 Review and approval by Commander.

## 2. DeskRPG Implementation
- [x] 2.1 Update `probeHermesGateway` in `src/lib/hermes/gateway-probe.ts` to accept optional `token` and forward `Authorization` header.
- [x] 2.2 Add unit test for token forwarding in `gateway-probe.test.ts`.
- [x] 2.3 Pass decrypted token in `src/lib/gateway-resources.ts` and test routes when probing gateway resources.
- [x] 2.4 Run DeskRPG test suite (`npx tsx --test`) to verify probe changes (14/14 passed).

## 3. Hermes Gateway Implementation
- [x] 3.1 Update `_auth_failed_response()` in `oss/hermes-agent/gateway/platforms/api_server.py` to add `headers={"Connection": "close"}`.
- [x] 3.2 Verify syntax with `python -m py_compile`.
- [x] 3.3 Test with pytest `test_api_server.py` (111/111 passed).

## 4. Verification & Deployment
- [x] 4.1 Git commit and push changes to user forks with SSH key (hermes-agent: `4e3d2b0f00`, deskrpg: `8f0dbfde`).
- [ ] 4.2 Deploy updated DeskRPG image / build to Intel NUC or rebuild container.
- [ ] 4.3 Validate and archive OpenSpec change.


