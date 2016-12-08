
# coding: utf-8

"""
Python script to clean CSV data prior to use with d3.

Some steps generic, but cleanup of Goal column very 
specific to the elements.csv dataset.
"""

from __future__ import print_function
import pandas as pd
import numpy as np
import re

# Do you want to filter out rows that have no
# stated goals? 
filter_out_blank_goals = True

# read data from csv
inpath = 'elements.csv'
df = pd.read_csv(inpath, dtype={'Goal': str})

# nan => blank space
df.fillna('', inplace=True)

# eliminate ALL space and non-word characters in column names
df.columns = [re.sub(r'\W', '', s) for s in df.columns]

# delete unuseful columns
discard_cols = 'Array Goal1 Goal2 Goal3'.split()
for d in discard_cols:
    del df[d]
    
# trim prefix and suffix spaces of all string values
for colname in df.columns:
    if df[colname].dtype == object:
        df.loc[:, colname] = df[colname].str.strip()
        
# for Goal column, either delete row or replace missing '
# ' with 'none'
if filter_out_blank_goals:
    df.loc[df.Goal == '', 'Goal'] = np.nan
    df.dropna(axis=0, inplace=True)
else:
    df.loc[df.Goal == '', 'Goal'] = 'none'

# sort digits of number-string goals
isnum = lambda s: all(c.isdigit() for c in s)
sortchars = lambda d: ''.join(sorted(d))
df.Goal = df.Goal.apply(lambda x: sortchars(x) if isnum(x) else x)

# This step assumes that goal order is not particularly important.
# Removing gratuitious permuations (e.g. '213', '312', '321' in favor
# of '123') should make downstream code simpler, more reliable.

# Show which goals are most prevalent
print("Goal counts")
print(df.Goal.value_counts())

# write cleaned file
outpath = inpath.replace('.csv', 'Clean.csv')
df.to_csv(outpath, index=False)

print("clean output written to", repr(outpath))
