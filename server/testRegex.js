const baseIdStr = 'BASE';
const r3 = new RegExp(`^${baseIdStr}(?: \\(\\d+\\))?(?:-T\\d)?$`);
console.log('3:', r3.test('BASE (1)'));
