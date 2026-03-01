export const sortList = (list: any[], way: string = 'desc') => {
    if (way === 'asc') {
        list.sort((a, b) => {
            return a.score - b.score;
        });
    } else if (way === 'desc') {
        list.sort((a, b) => {
            return b.score - a.score;
        });
    }
    return list;
};
